import { useEffect } from "react";

/** One viewport measurement for browser tabs, installed mode and dialogs. */
export default function MobileViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let baseline = viewport?.height ?? window.innerHeight;
    let orientation = window.innerWidth > window.innerHeight;
    let timer = 0;
    const measure = () => {
      frame = 0;
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      const active = document.activeElement;
      const editing =
        active instanceof HTMLElement &&
        (active.isContentEditable ||
          active.matches(
            "textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]):not([type=hidden])",
          ));
      const landscape = window.innerWidth > window.innerHeight;
      // Do not reset the baseline merely because a keyboard makes a portrait
      // viewport shorter. Reset only on an actual orientation-change event.
      if (!editing && landscape === orientation)
        baseline = Math.max(baseline, height);
      const inset = Math.max(0, window.innerHeight - height - top);
      const keyboard =
        editing &&
        (!viewport || Math.abs(viewport.scale - 1) < 0.05) &&
        (inset > 120 || baseline - height > 120);
      root.style.setProperty("--app-visible-height", `${height}px`);
      root.style.setProperty("--app-visible-top", `${top}px`);
      root.style.setProperty(
        "--app-keyboard-inset",
        `${keyboard ? inset : 0}px`,
      );
      root.style.setProperty("--dialog-viewport-height", `${height}px`);
      root.style.setProperty("--dialog-keyboard-inset", `${inset}px`);
      root.dataset.keyboardOpen = String(keyboard);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const rotate = () => {
      orientation = window.innerWidth > window.innerHeight;
      baseline = viewport?.height ?? window.innerHeight;
      schedule();
    };
    const focus = () => {
      schedule();
      window.clearTimeout(timer);
      timer = window.setTimeout(schedule, 300);
    };
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", rotate);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", focus);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", rotate);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", focus);
      delete root.dataset.keyboardOpen;
      [
        "--app-visible-height",
        "--app-visible-top",
        "--app-keyboard-inset",
        "--dialog-viewport-height",
        "--dialog-keyboard-inset",
      ].forEach((key) => root.style.removeProperty(key));
    };
  }, []);
  return null;
}
