import StoryForm from "@/components/StoryForm";

export default function NewStoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-headline font-bold mb-6 max-w-3xl mx-auto">
        New Story
      </h1>
      <StoryForm mode="create" />
    </div>
  );
}
