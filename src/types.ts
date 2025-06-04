
export type Component = string | number | ReactComponent;
export type Children = Component[];
export type Props = Record<string, any> & { children?: Children };

export type ReactElementTag<T> = (props: Props, children?: Children) => T;
export type SyncTag = string | ReactElementTag<Component>;
export type AsyncTag = ReactElementTag<Promise<Component>>;
export type Tag = SyncTag | AsyncTag;

export type ReactComponent = {
  tag: Tag;
  props: Props;
  children?: Children;
};

export type SuspenseComponent = ReactComponent & {
  __suspense?: {
    isSuspended: boolean;
    fallback: Component;
  };
};
