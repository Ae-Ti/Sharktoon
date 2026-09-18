/** 조건부 className 을 공백으로 합친다. falsy 는 버린다. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
