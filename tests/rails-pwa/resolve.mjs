export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('hfs/')) return { url: new URL(`../../app/javascript/${specifier}.js`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
