import { InfoButton } from "@/components/InfoButton";
import { ExerciseDisplayContent } from "@/components/ExerciseDisplayContent";
import { PageHeaderOverlay } from "@/components/PageHeaderOverlay";
import { warmupSections } from "@/lib/warmup";

const warmupInfoSections = [
  {
    title: "Цель разминки",
    content: (
      <>
        <p>Подготовить суставы и мышцы к работе, а не устать до тренировки.</p>
        <p>Держите ощущения легкими и рабочими, без выхода в отказ.</p>
      </>
    ),
  },
  {
    title: "Как выполнять",
    content: (
      <>
        <p>Все движения делайте плавно и подконтрольно.</p>
        <p>Избегайте рывков и резких переходов между упражнениями.</p>
      </>
    ),
  },
  {
    title: "Инвентарь и нагрузка",
    content: (
      <>
        <p>Резинки используйте средней жесткости.</p>
        <p>На тренажерах и блоках берите минимальный комфортный вес.</p>
      </>
    ),
  },
  {
    title: "Перед рабочими подходами",
    content: (
      <>
        <p>Постепенно повышайте нагрузку в подводящих подходах.</p>
        <p>Не делайте резких скачков по весу.</p>
      </>
    ),
  },
] as const;

function formatWarmupDescription(items: string[], note?: string): string {
  const lines = items.map((item) => `• ${item}`);
  if (note) {
    lines.push("", note);
  }
  return lines.join("\n");
}

export function WarmupPage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PageHeaderOverlay contentClassName="flex items-center gap-10 px-4">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-foreground">Разминка</p>
        </div>
        <InfoButton
          sheetTitle="Как делать разминку"
          sections={warmupInfoSections}
        />
      </PageHeaderOverlay>

      <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-6 px-4 pb-24 pt-20">
          {warmupSections.map((section) => (
            <section key={section.title} className="space-y-0">
              <div className="divide-y divide-border/70">
                {section.blocks.map((block, index) => (
                  <ExerciseDisplayContent
                    key={block.title}
                    className="py-4"
                    exercise={{
                      id: index + 1,
                      name: block.title,
                      category: "ACCESSORY",
                    }}
                    sets={[]}
                    notes={formatWarmupDescription(block.items, block.note)}
                    showCategoryLabel={false}
                    setsClassName="hidden"
                    nameClassName="text-foreground"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
