import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-semibold mb-2">{title}</p>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </div>
  );
}

export function InfoButton() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Справка">
          <Info className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Как читать программу</SheetTitle>
        </SheetHeader>
        <div className="px-4 space-y-6 text-sm">
          <Section title="Обозначения подходов">
            <p>
              <span className="font-mono tabular-nums">87,5 кг</span>
              {" / "}
              <span className="font-mono tabular-nums">×4×2</span>
              {" / "}
              <span className="font-mono tabular-nums">70%</span>
              <br />
              Слева вес в кг, по центру повторы и подходы, справа процент.
            </p>
            <p>
              <span className="font-mono tabular-nums"> </span>
              {" / "}
              <span className="font-mono tabular-nums">×20×4</span>
              {" / "}
              <span className="font-mono tabular-nums"> </span>
              <br />
              Вес подбирается индивидуально. Не работайте в отказ, запас 1-2
              повторения.
            </p>
            <p>
              <span className="font-mono tabular-nums">50 кг</span>
              {" / "}
              <span className="font-mono tabular-nums">×6×3</span>
              {" / "}
              <span className="font-mono tabular-nums"> </span>
              <br />
              Делаем с указанным весом в килограммах.
            </p>
            <p>
              <span className="font-mono tabular-nums"> </span>
              {" / "}
              <span className="font-mono tabular-nums">×15×4</span>
              {" / "}
              <span className="font-mono tabular-nums"> </span>
              <br />
              Собственный вес или пустая штанга.
            </p>
          </Section>

          <Section title="Проценты считаются от">
            <ul className="space-y-1">
              <li>Жимы - от разового жима лежа</li>
              <li>Приседания - от разового приседа</li>
              <li>Тяги - от разовой становой тяги</li>
            </ul>
          </Section>

          <Section title="Отдых между подходами">
            <p>Базовые упражнения: 3-5 мин</p>
            <p>Подсобка: 1-2 мин</p>
          </Section>

          <Section title="Суперсет">
            <p>Два упражнения подряд без отдыха между ними.</p>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
