export type ExcludeMatchingProperties<T, V> = Pick<
  T,
  { [K in keyof T]-?: T[K] extends V ? never : K }[keyof T]
>;
