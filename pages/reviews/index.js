Page({
  onLoad(options = {}) {
    const query = Object.keys(options)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(options[key] ?? "")}`)
      .join("&");
    const url = query
      ? `/subpackages/store/pages/reviews/index?${query}`
      : "/subpackages/store/pages/reviews/index";

    wx.redirectTo({ url });
  }
});
