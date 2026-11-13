import { lazy, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PwaPrompt } from "../../components/PwaPrompt";

const Access = lazy(() => import("./Access"));
const Exit = lazy(() => import("./Exit"));

export default function PublicAccess() {
  const location = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.scrollTo(0, 0));
    document.title = `${location.pathname.split("/")[1].replace(/^./, (c) => c.toUpperCase())} · Bellefort`;
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);
  return (
    <>
      <PwaPrompt />
      {location.pathname === "/sign-out" ? (
        <Exit />
      ) : (
        <Access key={location.pathname} />
      )}
    </>
  );
}
