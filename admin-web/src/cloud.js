import cloudbase from '@cloudbase/js-sdk'
import { CLOUDBASE_ENV } from './config'

const TOKEN_KEY = 'adminSessionToken'
const USERNAME_KEY = 'adminUsername'

let appRef = null

export function getStoredSessionToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setStoredSessionToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function getStoredAdminUsername() {
  return localStorage.getItem(USERNAME_KEY) || ''
}

export function setStoredAdminUsername(name) {
  if (name) {
    localStorage.setItem(USERNAME_KEY, name)
  } else {
    localStorage.removeItem(USERNAME_KEY)
  }
}

export async function getCloudApp() {
  if (!appRef) {
    appRef = cloudbase.init({
      env: CLOUDBASE_ENV
    })
  }
  const auth = appRef.auth()
  let loginState = null
  try {
    loginState = await auth.getLoginState()
  } catch (e) {
    loginState = null
  }
  if (!loginState) {
    try {
      await auth.signInAnonymously()
    } catch (e) {
      console.error('匿名登录失败，请在云开发控制台开启「匿名登录」:', e)
      throw e
    }
  }
  return appRef
}

/**
 * 管理员账号密码登录（创建服务端会话）
 */
export async function adminPasswordLogin(username, password) {
  const app = await getCloudApp()
  const res = await app.callFunction({
    name: 'adminManage',
    data: {
      action: 'adminLogin',
      data: { username, password }
    }
  })
  const result = res.result || res
  if (result && result.code === 200 && result.data && result.data.sessionToken) {
    setStoredSessionToken(result.data.sessionToken)
    if (username) {
      setStoredAdminUsername(String(username).trim())
    }
  }
  return result
}

function attachSession(payload) {
  const token = getStoredSessionToken()
  if (!token) {
    return payload
  }
  return {
    ...payload,
    adminSessionToken: token
  }
}

/**
 * 调用云函数（自动附带 adminSessionToken）
 */
export async function callAdminFunction(name, payload) {
  const app = await getCloudApp()
  const data = attachSession(payload)
  const res = await app.callFunction({ name, data })
  return res.result !== undefined ? res.result : res
}

export async function adminLogoutCloud() {
  const token = getStoredSessionToken()
  if (!token) {
    setStoredSessionToken('')
    setStoredAdminUsername('')
    return
  }
  try {
    const app = await getCloudApp()
    await app.callFunction({
      name: 'adminManage',
      data: attachSession({
        action: 'adminLogout',
        data: {}
      })
    })
  } catch (e) {
    console.warn('adminLogout', e)
  }
  setStoredSessionToken('')
  setStoredAdminUsername('')
}

/**
 * 浏览器上传图片到云存储（与小程序 wx.cloud.uploadFile 对齐，返回 fileID）
 * @param {File} file 来自 <input type="file"> 的文件
 * @param {string} [cloudPath] 可选，默认 banners/时间戳-随机名
 */
export async function uploadBannerImageFile(file, cloudPath) {
  const app = await getCloudApp()
  const ext = (file && file.name && file.name.split('.').pop()) || 'jpg'
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'jpg'
  const path =
    cloudPath ||
    `banners/${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${safeExt}`
  const uploadRes = await app.uploadFile({
    cloudPath: path,
    filePath: file
  })
  const fileID = uploadRes.fileID || uploadRes.fileId
  if (!fileID) {
    throw new Error(uploadRes.message || '上传失败')
  }
  return fileID
}

/** 将 cloud:// fileID 转为临时 HTTPS 链接（预览用） */
export async function getTempFileUrls(fileIDs) {
  if (!fileIDs || !fileIDs.length) {
    return []
  }
  const app = await getCloudApp()
  const res = await app.getTempFileURL({ fileList: fileIDs })
  return (res.fileList || []).map((x) => x.tempFileURL || x.download_url || '')
}
