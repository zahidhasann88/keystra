# Frameworks

Keystra only needs a DOM element. In any framework, create an instance when the element mounts and destroy it when it unmounts.

These examples show that lifecycle. They haven't been run inside each framework yet.

## React

```tsx
function Actions() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nav = createKeystra({ container: ref.current, items: 'button' });
    return () => nav.destroy();
  }, []);

  return <div ref={ref}>...</div>;
}
```

## Vue

```ts
const root = ref<HTMLElement>();
let nav: KeystraInstance;

onMounted(() => {
  nav = createKeystra({ container: root.value, items: 'button' });
});
onBeforeUnmount(() => nav.destroy());
```

## Svelte

```ts
let root: HTMLElement;

onMount(() => {
  const nav = createKeystra({ container: root, items: 'button' });
  return () => nav.destroy();
});
```

## Angular

```ts
ngAfterViewInit() {
  this.nav = createKeystra({ container: this.root.nativeElement, items: 'button' });
}

ngOnDestroy() {
  this.nav?.destroy();
}
```

## Server rendering

You can import Keystra on the server, because it doesn't touch the DOM until you use it. Create instances on the client, as in the examples above.
