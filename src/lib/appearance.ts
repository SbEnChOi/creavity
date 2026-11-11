export type Appearance = "light" | "dark";
export const APPEARANCE_KEY = "creavy.appearance.v1";

const redesignedRoutes = ["/ai", "/ideas", "/about", "/settings", "/ai-preview", "/login", "/ai-share"];

export function isRedesignedRoute(pathname: string): boolean {
  return redesignedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function resolveAppearance(value: string | null): Appearance {
  if (value === "dark" || value === "light") return value;
  return "light";
}

export const appearanceBootstrapScript = `(()=>{let value=null;try{value=localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)})}catch(e){}document.documentElement.dataset.theme=value==='dark'||value==='light'?value:'light'})()`;

export function preferenceFor(current: Appearance): Appearance {
  return current === "dark" ? "light" : "dark";
}

export function readAppearance(storage: Pick<Storage, "getItem">): Appearance {
  try { return resolveAppearance(storage.getItem(APPEARANCE_KEY)); }
  catch { return resolveAppearance(null); }
}

export function saveAppearance(storage: Pick<Storage, "setItem">, value: Appearance): boolean {
  try { storage.setItem(APPEARANCE_KEY, value); return true; }
  catch { return false; }
}
