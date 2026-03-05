import { useEffect } from "react";
import { initTelegram, isAuthorized } from "@/lib/telegram";
import { ProgramPage } from "@/pages/ProgramPage";
import { UnauthorizedScreen } from "@/components/UnauthorizedScreen";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

function App() {
  useEffect(() => {
    initTelegram();
  }, []);

  if (!DEV_MODE && !isAuthorized()) {
    return <UnauthorizedScreen />;
  }

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
