import StoryCard, { type StoryCardData } from "@/components/StoryCard";

interface Props {
  title: string;
  stories: StoryCardData[];
  showUpdated?: boolean;
  emptyMessage?: string;
}

export default function TrendingModule({
  title,
  stories,
  showUpdated = false,
  emptyMessage = "No stories yet.",
}: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
      <div className="bg-brand-dark px-4 py-2.5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
      </div>
      <div className="divide-y divide-gray-100 px-3">
        {stories.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4 text-center">{emptyMessage}</p>
        ) : (
          stories.map((story) => (
            <StoryCard key={story.id} story={story} size="compact" showUpdated={showUpdated} />
          ))
        )}
      </div>
    </div>
  );
}
