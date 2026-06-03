type AdSlotVariant = "leaderboard" | "infeed" | "rail" | "mid-article" | "sticky-mobile";

const DIMENSIONS: Record<AdSlotVariant, { label: string; className: string }> = {
  leaderboard:    { label: "728×90",  className: "h-[90px] max-w-[728px] mx-auto hidden md:flex" },
  infeed:         { label: "300×250", className: "h-[250px] max-w-[300px] mx-auto flex" },
  rail:           { label: "300×250", className: "h-[250px] w-full flex" },
  "mid-article":  { label: "300×250", className: "h-[250px] max-w-[300px] mx-auto flex" },
  "sticky-mobile":{ label: "320×50",  className: "h-[50px] w-full flex md:hidden" },
};

export default function AdSlot({ variant }: { variant: AdSlotVariant }) {
  const { label, className } = DIMENSIONS[variant];
  return (
    <div
      className={`${className} items-center justify-center border border-dashed border-gray-300 bg-gray-50 rounded text-xs text-gray-400 my-4`}
      aria-label="Advertisement placeholder"
    >
      <span className="uppercase tracking-wider font-medium">Advertisement · {label}</span>
    </div>
  );
}
