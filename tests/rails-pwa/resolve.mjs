export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('hfs/') || specifier.startsWith('amelia3/')) return { url: new URL(`../../app/javascript/${specifier}.js`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
