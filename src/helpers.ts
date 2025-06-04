import type {
  AsyncTag,
  ReactComponent,
  Component,
  Props,
  Tag,
  Children,
} from "./types";

export function isServerComponent(tag: Tag, props: Props): tag is AsyncTag {
  if (!tag) return false;
  if (typeof tag === "string") return false;
  if (typeof tag !== "function") return false;
  return tag(props) instanceof Promise;
}

export function mergeProps(...props: Props[]) {
  return { ...props[0], ...props[1] };
}

export function isFragment(tag: Tag, props: Props): boolean {
  return tag === undefined && !!props?.children;
}

export function isPrimitive(component: unknown): component is string | number {
  return typeof component === "string" || typeof component === "number";
}

export function isSuspenseComponent(
  component: ReactComponent
): component is ReactComponent & {
  __suspense: {
    isSuspended: boolean;
    fallback: Component;
    cleanup?: () => void;
  };
} {
  return (
    "__suspense" in component &&
    typeof component.__suspense === "object" &&
    "fallback" in component.__suspense
  );
}

export function isPromise(value: unknown): value is Promise<unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as Promise<unknown>).then === "function"
  );
}

export function joinChildren(...args: Children[]): Component[] {
  const result: Set<Component> = new Set();
  for (const children of args) {
    if (Array.isArray(children)) {
      for (const child of children) {
        if (Array.isArray(child)) {
          for (const subChild of child) {
            if (subChild !== undefined) result.add(subChild);
          }
        } else if (child !== undefined) {
          result.add(child);
        }
      }
    }
  }

  return Array.from(result);
}
