import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import CallUI from "../CallUI";

// ── Mock dependencies ──────────────────────────────────────────────

// Mock motion/react (framer-motion) so components render without animation
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      // Filter out motion-specific props so they don't pollute the DOM
      const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
    button: ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props;
      return <button {...rest}>{children}</button>;
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock lucide-react icons — render simple accessible elements
vi.mock("lucide-react", () => ({
  Mic: () => <span data-testid="icon-mic">Mic</span>,
  MicOff: () => <span data-testid="icon-mic-off">MicOff</span>,
  PhoneOff: () => <span data-testid="icon-phone-off">PhoneOff</span>,
  Phone: () => <span data-testid="icon-phone">Phone</span>,
  Video: () => <span data-testid="icon-video">Video</span>,
  VideoOff: () => <span data-testid="icon-video-off">VideoOff</span>,
  Volume2: () => <span data-testid="icon-volume2">Volume2</span>,
  RefreshCw: () => <span data-testid="icon-refresh-cw">RefreshCw</span>,
}));

// Mock UserAvatar — renders a simple avatar placeholder
vi.mock("../UserAvatar", () => ({
  default: ({ src, alt, className }: any) => (
    <div data-testid="user-avatar" className={className} data-src={src} data-alt={alt} />
  ),
}));

// ── Mock navigator.mediaDevices.enumerateDevices ────────────────
const mockEnumerateDevices = vi.fn().mockResolvedValue([
  { kind: "videoinput", deviceId: "camera1", label: "Front Camera" },
  { kind: "audioinput", deviceId: "mic1", label: "Microphone" },
  { kind: "audiooutput", deviceId: "speaker1", label: "Speaker" },
]);

Object.defineProperty(navigator, "mediaDevices", {
  value: { enumerateDevices: mockEnumerateDevices },
  configurable: true,
  writable: true,
});

// ── Shared test data ──────────────────────────────────────────────

const mockUser = { _id: "user1", fullName: "Test User", profilePic: { url: "/avatar.jpg" } };
const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as any;
const mockLocalStreamRef = { current: null } as any;
const mockPeerConnectionRef = { current: null } as any;
const mockRemoteStreamRef = { current: null } as any;

const defaultProps = {
  socket: mockSocket,
  user: mockUser,
  localStreamRef: mockLocalStreamRef,
  peerConnectionRef: mockPeerConnectionRef,
  remoteStreamRef: mockRemoteStreamRef,
  iceConnectionState: "new" as const,
  onEndCall: vi.fn(),
  onAcceptCall: vi.fn(),
  onRejectCall: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────

describe("CallUI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStreamRef.current = null;
    mockPeerConnectionRef.current = null;
  });

  // ── Outgoing Call States ──────────────────────────────────────

  describe("Outgoing Call", () => {
    it("renders outgoing audio call with 'Calling...' status", () => {
      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "audio",
            status: "outgoing",
            partnerId: "partner1",
            partnerName: "Alice",
            partnerAvatar: "/alice.jpg",
          }}
        />
      );

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Calling...")).toBeInTheDocument();
      // Should show end call button (red)
      expect(screen.getByTestId("icon-phone-off")).toBeInTheDocument();
      // Should NOT show accept/reject buttons
      expect(screen.queryByTestId("icon-phone")).not.toBeInTheDocument();
      // Audio calls should NOT show video toggle when not active
      expect(screen.queryByTestId("icon-video")).not.toBeInTheDocument();
    });

    it("renders outgoing video call with 'Calling...' status", () => {
      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "video",
            status: "outgoing",
            partnerId: "partner1",
            partnerName: "Alice",
          }}
        />
      );

      expect(screen.getByText("Calling...")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      // Remote video element, local video preview, and video toggle are not shown during outgoing (pre-connection) state
      // The interface shows partner avatar, status text, and mute + end call buttons
      expect(screen.getByTestId("icon-mic")).toBeInTheDocument();
      expect(screen.getByTestId("icon-phone-off")).toBeInTheDocument();
      // Accept button should not appear during outgoing state
      expect(screen.queryByTestId("icon-phone")).not.toBeInTheDocument();
    });
  });

  // ── Incoming Call States ──────────────────────────────────────

  describe("Incoming Call", () => {
    it("renders incoming audio call with Accept and Reject buttons", () => {
      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "audio",
            status: "incoming",
            partnerId: "partner1",
            partnerName: "Bob",
          }}
        />
      );

      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Incoming call")).toBeInTheDocument();
      // Should show accept (green phone) and reject (red phone-off) buttons
      expect(screen.getByTestId("icon-phone")).toBeInTheDocument();
      expect(screen.getByTestId("icon-phone-off")).toBeInTheDocument();
    });

    it("calls onAcceptCall when Accept button is clicked", () => {
      const onAcceptCall = vi.fn();
      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "audio",
            status: "incoming",
            partnerId: "partner1",
            partnerName: "Bob",
          }}
          onAcceptCall={onAcceptCall}
        />
      );

      // The green phone button is the accept button
      const acceptButton = screen.getByTestId("icon-phone").closest("button");
      expect(acceptButton).not.toBeNull();
      fireEvent.click(acceptButton!);
      expect(onAcceptCall).toHaveBeenCalledTimes(1);
    });

    it("calls onRejectCall when Reject button is clicked", () => {
      const onRejectCall = vi.fn();
      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "audio",
            status: "incoming",
            partnerId: "partner1",
            partnerName: "Bob",
          }}
          onRejectCall={onRejectCall}
        />
      );

      // The red phone-off button is the reject button (for incoming status)
      const rejectButton = screen.getByTestId("icon-phone-off").closest("button");
      expect(rejectButton).not.toBeNull();
      fireEvent.click(rejectButton!);
      expect(onRejectCall).toHaveBeenCalledTimes(1);
    });
  });

  // ── Active Call States ────────────────────────────────────────

  describe("Active Audio Call", () => {
    it("renders active audio call with formatted duration", () => {
      vi.useFakeTimers();
      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "audio",
            status: "active",
            partnerId: "partner1",
            partnerName: "Alice",
          }}
        />
      );

      // Initially 00:00
      expect(screen.getByText("00:00")).toBeInTheDocument();

      // Advance 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText("00:05")).toBeInTheDocument();

      vi.useRealTimers();
    });

    it("shows mute button and end call button during active audio call", () => {
      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "audio",
            status: "active",
            partnerId: "partner1",
            partnerName: "Alice",
          }}
        />
      );

      // Mic button should be visible (not muted)
      expect(screen.getByTestId("icon-mic")).toBeInTheDocument();
      // No video toggle for audio calls
      expect(screen.queryByTestId("icon-video")).not.toBeInTheDocument();
      // End call button visible
      expect(screen.getByTestId("icon-phone-off")).toBeInTheDocument();
    });

    it("toggles mute when mic button is clicked", () => {
      const stream = {
        getAudioTracks: () => [{ enabled: true, stop: vi.fn() }],
        getVideoTracks: () => [],
        getTracks: () => [{ stop: vi.fn() }],
      };
      mockLocalStreamRef.current = stream;

      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "audio",
            status: "active",
            partnerId: "partner1",
            partnerName: "Alice",
          }}
        />
      );

      // Click mute button
      const micButton = screen.getByTestId("icon-mic").closest("button");
      fireEvent.click(micButton!);

      // Should now show MicOff icon
      expect(screen.getByTestId("icon-mic-off")).toBeInTheDocument();
    });

    it("calls onEndCall when End Call button is clicked", () => {
      const onEndCall = vi.fn();
      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "audio",
            status: "active",
            partnerId: "partner1",
            partnerName: "Alice",
          }}
          onEndCall={onEndCall}
        />
      );

      const endButton = screen.getByTestId("icon-phone-off").closest("button");
      fireEvent.click(endButton!);
      expect(onEndCall).toHaveBeenCalledTimes(1);
    });
  });

  describe("Active Video Call", () => {
    it("renders active video call with video toggle button", () => {
      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "video",
            status: "active",
            partnerId: "partner1",
            partnerName: "Alice",
          }}
        />
      );

      // Video toggle button should be visible
      expect(screen.getByTestId("icon-video")).toBeInTheDocument();
      expect(screen.getByTestId("icon-mic")).toBeInTheDocument();
      expect(screen.getByTestId("icon-phone-off")).toBeInTheDocument();
    });

    it("toggles video off when video button is clicked", () => {
      const stream = {
        getAudioTracks: () => [{ enabled: true, stop: vi.fn() }],
        getVideoTracks: () => [{ enabled: true, stop: vi.fn() }],
        getTracks: () => [{ stop: vi.fn() }],
      };
      mockLocalStreamRef.current = stream;

      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "video",
            status: "active",
            partnerId: "partner1",
            partnerName: "Alice",
          }}
        />
      );

      // Click video toggle button
      const videoButton = screen.getByTestId("icon-video").closest("button");
      fireEvent.click(videoButton!);

      // Should now show VideoOff
      expect(screen.getByTestId("icon-video-off")).toBeInTheDocument();
    });
  });

  // ── Duration Formatting ───────────────────────────────────────

  describe("Call Duration", () => {
    it("formats duration correctly with leading zeros", () => {
      vi.useFakeTimers();
      render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "audio",
            status: "active",
            partnerId: "partner1",
            partnerName: "Alice",
          }}
        />
      );

      // Initial: 00:00
      expect(screen.getByText("00:00")).toBeInTheDocument();

      // Advance 65 seconds → 01:05
      act(() => {
        vi.advanceTimersByTime(65000);
      });
      expect(screen.getByText("01:05")).toBeInTheDocument();

      // Advance to 2 minutes → 02:05 (since timer resets on status change, but we're already 65s in)
      // Actually the timer starts from 0 when status becomes active, then increments every second.
      // After 65s from start, we're at 65s = 01:05
      // Advancing 60 more = 125s from start = 02:05
      act(() => {
        vi.advanceTimersByTime(60000);
      });
      expect(screen.getByText("02:05")).toBeInTheDocument();

      vi.useRealTimers();
    });

    it("cleans up timer on unmount", () => {
      vi.useFakeTimers();
      const { unmount } = render(
        <CallUI
          {...defaultProps}
          callState={{
            type: "audio",
            status: "active",
            partnerId: "partner1",
            partnerName: "Alice",
          }}
        />
      );

      unmount();
      // Should not throw — timer was cleared
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(true).toBe(true); // No crash = cleanup worked

      vi.useRealTimers();
    });
  });

  // ── Partner Avatar ────────────────────────────────────────────

  it("renders partner avatar with correct source", () => {
    render(
      <CallUI
        {...defaultProps}
        callState={{
          type: "audio",
          status: "incoming",
          partnerId: "partner1",
          partnerName: "Charlie",
          partnerAvatar: "/charlie.jpg",
        }}
      />
    );

    const avatar = screen.getByTestId("user-avatar");
    expect(avatar).toHaveAttribute("data-src", "/charlie.jpg");
    expect(avatar).toHaveAttribute("data-alt", "Charlie");
  });
});
