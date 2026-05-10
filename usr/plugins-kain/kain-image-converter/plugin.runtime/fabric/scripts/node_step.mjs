export function run(fabricInputs) {
  const read = (root, path) => path.reduce((value, key) => value?.[key], root);
  const report =
    read(fabricInputs, ['kain_orchestrator', 'report']) ??
    read(fabricInputs, ['kain_orchestrator', 'report', 'value', 'json']) ??
    'dependency-ordered-after-kain';
  const analysis =
    read(fabricInputs, ['rust_analyzer', 'analysis']) ??
    read(fabricInputs, ['rust_analyzer', 'analysis', 'analysis']) ??
    read(fabricInputs, ['rust_analyzer', 'analysis', 'value', 'json', 'analysis']) ??
    'dependency-ordered-after-rust';
  const inputKeys = Object.keys(fabricInputs ?? {});
  return {
    summary: {
      title: 'kain-image-converter-fabric',
      report,
      analysis,
      inputKeys,
      inputProjection: inputKeys.length > 0 ? 'received' : 'empty-js-object',
      packagedBy: 'node',
    },
    input_keys: inputKeys.join(','),
  };
}
