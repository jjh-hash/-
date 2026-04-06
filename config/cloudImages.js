/**
 * 静态图片云端配置（用于减少主包体积，images/ 已从打包中排除）
 * 请先将 images/ 下大图上传至云存储，再将 fileID 填入下方
 * 详见 docs/云存储图片上传说明.md
 */
const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 透明占位

const config = {
  expressIcon: 'cloud://cloud1-7g0bpzkg04df43f9.636c-cloud1-7g0bpzkg04df43f9-1357734676/static/ca38ed2604e57582105e941b16ac64ab.jpg',
  gamingIcon: 'cloud://cloud1-7g0bpzkg04df43f9.636c-cloud1-7g0bpzkg04df43f9-1357734676/static/27e611ce6700b2100b57425af52f931b.jpg',
  secondhandIcon: 'cloud://cloud1-7g0bpzkg04df43f9.636c-cloud1-7g0bpzkg04df43f9-1357734676/static/09a0485967ded76dac25c980f66f8568.jpg',
  serviceFlashBg: 'cloud://cloud1-7g0bpzkg04df43f9.636c-cloud1-7g0bpzkg04df43f9-1357734676/static/service-flash-bg.png',
  deliveryBoyIcon: 'cloud://cloud1-7g0bpzkg04df43f9.636c-cloud1-7g0bpzkg04df43f9-1357734676/static/delivery-boy-icon.png'
};

function getUrl(key) {
  const v = config[key];
  return (v && typeof v === 'string' && v.startsWith('cloud://')) ? v : null;
}

module.exports = {
  get expressIcon() { return getUrl('expressIcon') || PLACEHOLDER; },
  get gamingIcon() { return getUrl('gamingIcon') || PLACEHOLDER; },
  get secondhandIcon() { return getUrl('secondhandIcon') || PLACEHOLDER; },
  get serviceFlashBg() { return getUrl('serviceFlashBg') || PLACEHOLDER; },
  get deliveryBoyIcon() { return getUrl('deliveryBoyIcon') || PLACEHOLDER; },
  setConfig: (key, fileId) => { if (key in config) config[key] = fileId; }
};
