import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, CheckCircle, AlertCircle, Volume2, Info, RefreshCw } from "lucide-react";
import GlassCard from "./GlassCard";

interface AudioDiagnostics {
  sampleRate: number | null;
  echoCancellation: boolean | null;
  noiseSuppression: boolean | null;
  autoGainControl: boolean | null;
  channelCount: number | null;
  browserSupport: {
    getUserMedia: boolean;
    RTCPeerConnection: boolean;
    enumerateDevices: boolean;
    setSinkId: boolean;
    webAudio: boolean;
  };
}

interface TestResult {
  phase: "idle" | "recording" | "playing" | "done";
  duration: number;
  playbackDevice: string;
}

export default function EchoTest() {
  const [testState, setTestState] = useState<TestResult>({
    phase: "idle",
    duration: 0,
    playbackDevice: "",
  });
  const [audioLevel, setAudioLevel] = useState(0);
  const [diagnostics, setDiagnostics] = useState<AudioDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(3);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Gather diagnostics on mount
  useEffect(() => {
    const diag: AudioDiagnostics = {
      sampleRate: null,
      echoCancellation: null,
      noiseSuppression: null,
      autoGainControl: null,
      channelCount: null,
      browserSupport: {
        getUserMedia: !!navigator.mediaDevices?.getUserMedia,
        RTCPeerConnection: !!window.RTCPeerConnection,
        enumerateDevices: !!navigator.mediaDevices?.enumerateDevices,
        setSinkId: typeof document.createElement("audio").setSinkId === "function",
        webAudio: !!window.AudioContext || !!((window as any).webkitAudioContext),
      },
    };
    setDiagnostics(diag);
  }, []);

  // Microphone level meter
  const startLevelMeter = useCallback((stream: MediaStream) => {
    try {
      // Close any previous AudioContext to prevent memory leaks
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setAudioLevel(Math.min(100, Math.round(rms * 180)));
        animationRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Meter unavailable silently
    }
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      stopLevelMeter();
    };
  }, [stopLevelMeter]);

  const startRecording = async () => {
    setError(null);
    setSuccess(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      // Update diagnostics with actual constraints
      const track = stream.getAudioTracks()[0];
      const settings = track.getSettings();
      setDiagnostics((prev) =>
        prev
          ? {
              ...prev,
              sampleRate: settings.sampleRate || null,
              echoCancellation: settings.echoCancellation ?? null,
              noiseSuppression: settings.noiseSuppression ?? null,
              autoGainControl: settings.autoGainControl ?? null,
              channelCount: settings.channelCount || null,
            }
          : prev
      );

      // Start level meter
      startLevelMeter(stream);

      // Set up recorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg;codecs=opus";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopLevelMeter();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Play back the recorded audio
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          setTestState({ phase: "done", duration: recordingDuration, playbackDevice: "" });
          URL.revokeObjectURL(url);
          // Stop the microphone stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          setSuccess("Echo test complete. You should have heard your recording played back.");
        };

        setTestState({ phase: "playing", duration: recordingDuration, playbackDevice: "" });
        audio.play().catch((err) => {
          setError(`Playback failed: ${err.message}. Try tapping the screen first (iOS).`);
          URL.revokeObjectURL(url);
        });
      };

      // Record for the selected duration
      recorder.start();
      setTestState({ phase: "recording", duration: 0, playbackDevice: "" });

      // Update recording timer
      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTestState((prev) => ({
          ...prev,
          duration: Math.min(elapsed, recordingDuration),
        }));
        if (elapsed >= recordingDuration) {
          clearInterval(timer);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
          }
        }
      }, 200);
    } catch (err: any) {
      setError(`Microphone access denied or unavailable: ${err.message}`);
      stopLevelMeter();
    }
  };

  const stopTest = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    stopLevelMeter();
    setTestState({ phase: "idle", duration: 0, playbackDevice: "" });
    setError(null);
    setSuccess(null);
  };

  const formatDiagValue = (val: any): string => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "Yes" : "No";
    return String(val);
  };

  return (
    <div className="space-y-5">
      <GlassCard animate className="p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3">
          <Volume2 className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Audio Echo Test
          </h3>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed mb-5">
          This test records a short audio sample and plays it back, letting you verify
          your microphone, speaker, and echo cancellation are working correctly.
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-emerald-400">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Recording duration selector */}
        <div className="flex items-center gap-3 mb-5">
          <label className="text-[12px] md:text-sm font-bold uppercase tracking-wider text-zinc-400">
            Duration:
          </label>
          <div className="flex gap-1.5">
            {[2, 3, 5].map((d) => (
              <button
                key={d}
                onClick={() => { if (testState.phase === "idle") setRecordingDuration(d); }}
                disabled={testState.phase !== "idle"}
                className={`h-7 min-w-[2rem] rounded-full text-[12px] md:text-sm font-bold transition-all cursor-pointer ${
                  recordingDuration === d
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : testState.phase === "idle"
                      ? "bg-zinc-800/50 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
                      : "bg-zinc-800/30 text-zinc-600 border border-zinc-800 cursor-not-allowed"
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        {/* Microphone level meter — active during recording */}
        {(testState.phase === "recording" || testState.phase === "playing") && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                {testState.phase === "recording" ? "Recording..." : "Playing..."}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {testState.duration}s / {recordingDuration}s
              </span>
            </div>
            <div className="flex items-center gap-[3px] h-7">
              {Array.from({ length: 24 }).map((_, i) => {
                const threshold = ((i + 1) / 24) * 100;
                const active = audioLevel >= threshold;
                const height = 4 + (i / 24) * 20;
                return (
                  <span
                    key={i}
                    className="w-[5px] rounded-full transition-all duration-75"
                    style={{
                      height: `${height}px`,
                      backgroundColor: active
                        ? threshold > 70
                          ? "rgb(239 68 68)"
                          : threshold > 40
                            ? "rgb(251 191 36)"
                            : "rgb(52 211 153)"
                        : "rgba(255,255,255,0.08)",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Start / Stop button */}
        <div className="flex gap-3">
          {testState.phase === "idle" && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 rounded-full bg-indigo-500 hover:bg-indigo-600 px-5 py-2.5 text-[12px] md:text-sm font-bold text-white transition-all cursor-pointer"
            >
              <Mic className="h-4 w-4" />
              Start Test
            </button>
          )}
          {(testState.phase === "recording" || testState.phase === "playing") && (
            <button
              onClick={stopTest}
              className="flex items-center gap-2 rounded-full bg-rose-500 hover:bg-rose-600 px-5 py-2.5 text-[12px] md:text-sm font-bold text-white transition-all cursor-pointer"
            >
              <Square className="h-4 w-4" />
              {testState.phase === "recording" ? "Stop Recording" : "Stop Playback"}
            </button>
          )}
          {testState.phase === "done" && (
            <button
              onClick={stopTest}
              className="flex items-center gap-2 rounded-full bg-zinc-700 hover:bg-zinc-600 px-5 py-2.5 text-[12px] md:text-sm font-bold text-white transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Test Again
            </button>
          )}
        </div>
      </GlassCard>

      {/* Diagnostics Card */}
      <GlassCard animate className="p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3">
          <Info className="h-4 w-4 text-sky-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Audio Diagnostics
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Browser Support */}
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Browser Support
            </h4>
            <div className="space-y-1.5">
              {diagnostics &&
                Object.entries(diagnostics.browserSupport).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        val ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {val ? "✓" : "✗"}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Active Microphone Settings */}
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Mic Settings
            </h4>
            <div className="space-y-1.5">
              {diagnostics ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">Sample Rate</span>
                    <span className="text-[10px] font-mono text-zinc-300">
                      {diagnostics.sampleRate ? `${diagnostics.sampleRate} Hz` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">Channels</span>
                    <span className="text-[10px] font-mono text-zinc-300">
                      {formatDiagValue(diagnostics.channelCount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">Echo Cancellation</span>
                    <span className={`text-[10px] font-bold ${diagnostics.echoCancellation ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatDiagValue(diagnostics.echoCancellation)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">Noise Suppression</span>
                    <span className={`text-[10px] font-bold ${diagnostics.noiseSuppression ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatDiagValue(diagnostics.noiseSuppression)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">Auto Gain Control</span>
                    <span className={`text-[10px] font-bold ${diagnostics.autoGainControl ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatDiagValue(diagnostics.autoGainControl)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-zinc-500 italic">
                  Start a test to see active settings
                </p>
              )}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
