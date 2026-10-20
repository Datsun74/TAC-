type PageIntroProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
}>;

export function PageIntro({ eyebrow, title, description }: PageIntroProps) {
  return (
    <header className="max-w-2xl">
      <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{title}</h1>
      <p className="mt-4 text-base leading-7 text-stone-600 sm:text-lg">{description}</p>
    </header>
  );
}
