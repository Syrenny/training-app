import { useEffect } from "react";
import { initTelegram } from "@/lib/telegram";
import { ProgramPage } from "@/pages/ProgramPage";

function App() {
  useEffect(() => {
    initTelegram();
  }, []);

  return (
    <div
      className="min-h-[var(--tg-viewport-height,100vh)] bg-background text-foreground overflow-y-auto"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ProgramPage />
    </div>
  );
}

export default App;
