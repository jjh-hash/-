/**
 * Skyline 自定义路由：实现更流畅的「从右向左滑入」页面转场
 * - 需在 app.json 或对应页面的 json 中启用 "renderer": "skyline"
 * - 需在 微信开发者工具 / project.private.config 中开启 skylineRenderEnable
 * - 低版本或未启用 Skyline 时会自动降级为普通 navigateTo
 */

const ROUTE_TYPE = 'Cupertino';

function registerSkylineRoute() {
  if (typeof wx === 'undefined' || !wx.router || !wx.router.addRouteBuilder) {
    return false;
  }
  try {
    const { windowWidth } = wx.getWindowInfo();
    wx.router.addRouteBuilder(ROUTE_TYPE, function (ctx) {
      const {
        primaryAnimation,
        secondaryAnimation
      } = ctx;
      const handlePrimaryAnimation = function () {
        'worklet';
        const t = primaryAnimation.value;
        const translateX = windowWidth * (1 - t);
        return { transform: `translateX(${translateX}px)` };
      };
      const handleSecondaryAnimation = function () {
        'worklet';
        const t = secondaryAnimation.value;
        const translateX = -windowWidth * 0.3 * (1 - t);
        return { transform: `translateX(${translateX}px)` };
      };
      return {
        handlePrimaryAnimation,
        handleSecondaryAnimation,
        opaque: true,
        transitionDuration: 300,
        reverseTransitionDuration: 300,
        canTransitionTo: true,
        canTransitionFrom: true
      };
    });
    return true;
  } catch (e) {
    console.warn('[skylineRoute] addRouteBuilder fail', e);
    return false;
  }
}

let skylineSupported = null;

/**
 * 是否支持 Skyline 自定义路由
 */
function isSkylineRouteSupported() {
  if (skylineSupported === null) {
    skylineSupported = registerSkylineRoute();
  }
  return skylineSupported;
}

/**
 * 带滑动转场的 navigateTo（仅在 Skyline 下使用自定义路由，否则与 wx.navigateTo 一致）
 * @param {Object} options - 与 wx.navigateTo 相同（url, success, fail, complete 等）
 * @param {string} [options.routeType] - 不传则使用默认 'Cupertino'；传 false 表示本次不用自定义路由
 */
function navigateToWithSlide(options) {
  const opts = { ...options };
  const useRouteType = opts.routeType !== false && isSkylineRouteSupported();
  if (useRouteType) {
    opts.routeType = opts.routeType || ROUTE_TYPE;
  } else {
    delete opts.routeType;
  }
  wx.navigateTo(opts);
}

module.exports = {
  registerSkylineRoute,
  isSkylineRouteSupported,
  navigateToWithSlide,
  ROUTE_TYPE
};
