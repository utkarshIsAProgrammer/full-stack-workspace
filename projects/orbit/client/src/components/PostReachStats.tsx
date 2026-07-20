import { Eye, Heart, MessageSquare, Bookmark, Repeat2, TrendingUp, BarChart3 } from "lucide-react";

interface PostReachStatsProps {
  viewsCount?: number;
  likesCount?: number;
  commentsCount?: number;
  savesCount?: number;
  sharesCount?: number;
}

export default function PostReachStats({
  viewsCount = 0,
  likesCount = 0,
  commentsCount = 0,
  savesCount = 0,
  sharesCount = 0,
}: PostReachStatsProps) {
  const engagement = viewsCount > 0 ? ((likesCount + commentsCount + savesCount + sharesCount) / viewsCount * 100).toFixed(1) : "0.0";

  return (
    <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-sky-400" />
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Reach Stats</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-400">
          <TrendingUp className="h-3 w-3" />
          <span className="text-[10px] font-bold">{engagement}% eng.</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div className="flex flex-col items-center gap-1 rounded-lg bg-zinc-800/20 p-2">
          <Eye className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-bold text-white">{viewsCount.toLocaleString()}</span>
          <span className="text-[8px] text-zinc-500 uppercase">Views</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg bg-zinc-800/20 p-2">
          <Heart className="h-4 w-4 text-red-400" />
          <span className="text-sm font-bold text-white">{likesCount.toLocaleString()}</span>
          <span className="text-[8px] text-zinc-500 uppercase">Likes</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg bg-zinc-800/20 p-2">
          <MessageSquare className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-bold text-white">{commentsCount.toLocaleString()}</span>
          <span className="text-[8px] text-zinc-500 uppercase">Comments</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg bg-zinc-800/20 p-2">
          <Bookmark className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-bold text-white">{savesCount.toLocaleString()}</span>
          <span className="text-[8px] text-zinc-500 uppercase">Saves</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg bg-zinc-800/20 p-2">
          <Repeat2 className="h-4 w-4 text-green-400" />
          <span className="text-sm font-bold text-white">{sharesCount.toLocaleString()}</span>
          <span className="text-[8px] text-zinc-500 uppercase">Shares</span>
        </div>
      </div>
    </div>
  );
}
