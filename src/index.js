// const logger = require('@varnxy/logger')
// logger.setDirectory('/Users/zhang/Work/WorkSpaces/WebWorkSpace/picgo-plugin-web-uploader/logs')
// let log = logger('plugin')

module.exports = (ctx) => {
  /**
   * 在 PicGo 啟動時註冊 uploader
   */
  const register = () => {
    ctx.helper.uploader.register('web-uploader', {
      handle,
      name: '自定义Web图床',
      config: config
    })
  }

  /**
   * 處理上傳邏輯
   */
  const handle = async function (ctx) {
    let userConfig = ctx.getConfig('picBed.web-uploader')
    if (!userConfig) {
      throw new Error('Can\'t find uploader config')
    }

    const {
      url,
      paramName,
      jsonPath,
      customHeader,
      customBody,
      prefix = '' // 新增的自定義路徑前綴
    } = userConfig

    try {
      let imgList = ctx.output
      for (let i in imgList) {
        let image = imgList[i].buffer
        if (!image && imgList[i].base64Image) {
          image = Buffer.from(imgList[i].base64Image, 'base64')
        }

        const postConfig = postOptions(image, customHeader, customBody, url, paramName, imgList[i].fileName)
        let body = await ctx.Request.request(postConfig)

        // 清理臨時欄位，避免輸出多餘資料
        delete imgList[i].base64Image
        delete imgList[i].buffer

        let imgUrl
        if (!jsonPath) {
          imgUrl = body
        } else {
          try {
            body = JSON.parse(body)
          } catch (_) {
            body = {}
          }
          imgUrl = body
          for (let field of jsonPath.split('.')) {
            if (imgUrl == null) break
            imgUrl = imgUrl[field]
          }
        }

        if (imgUrl) {
          imgList[i]['imgUrl'] = buildUrl(imgUrl, prefix)
        } else {
          ctx.emit('notification', {
            title: '返回解析失败',
            body: '请检查JsonPath设置'
          })
        }
      }
    } catch (err) {
      ctx.emit('notification', {
        title: '上传失败',
        body: JSON.stringify(err)
      })
    }
  }

  /**
   * 拼接 URL，如果 imgUrl 為相對路徑則加上 prefix
   * @param {string} imgUrl 從伺服器取得的圖片 URL
   * @param {string} prefix 自定義前綴
   * @returns {string}
   */
  const buildUrl = (imgUrl, prefix) => {
    if (!prefix) return imgUrl
    // 已經是絕對 URL 直接返回
    if (/^https?:\/\//i.test(imgUrl)) return imgUrl

    const trimmedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
    const trimmedImgUrl = imgUrl.startsWith('/') ? imgUrl : `/${imgUrl}`
    return `${trimmedPrefix}${trimmedImgUrl}`
  }

  /**
   * 構造 request 參數
   */
  const postOptions = (image, customHeader, customBody, url, paramName, fileName) => {
    let headers = {
      contentType: 'multipart/form-data',
      'User-Agent': 'PicGo'
    }
    if (customHeader) {
      headers = Object.assign(headers, JSON.parse(customHeader))
    }
    let formData = {}
    if (customBody) {
      formData = Object.assign(formData, JSON.parse(customBody))
    }
    const opts = {
      method: 'POST',
      url: url,
      headers: headers,
      formData: formData
    }
    opts.formData[paramName] = {
      value: image,
      options: {
        filename: fileName
      }
    }
    return opts
  }

  /**
   * PicGo 設定面板配置
   */
  const config = ctx => {
    let userConfig = ctx.getConfig('picBed.web-uploader') || {}
    return [
      {
        name: 'url',
        type: 'input',
        default: userConfig.url,
        required: true,
        message: 'API地址',
        alias: 'API地址'
      },
      {
        name: 'paramName',
        type: 'input',
        default: userConfig.paramName,
        required: true,
        message: 'POST参数名',
        alias: 'POST参数名'
      },
      {
        name: 'jsonPath',
        type: 'input',
        default: userConfig.jsonPath,
        required: false,
        message: '图片URL JSON路径(eg: data.url)',
        alias: 'JSON路径'
      },
      {
        name: 'prefix',
        type: 'input',
        default: userConfig.prefix,
        required: false,
        message: '自定义路径前缀(eg: https://your-domain)',
        alias: '路径前缀'
      },
      {
        name: 'customHeader',
        type: 'input',
        default: userConfig.customHeader,
        required: false,
        message: '自定义请求头 标准JSON(eg: {"key":"value"})',
        alias: '自定义请求头'
      },
      {
        name: 'customBody',
        type: 'input',
        default: userConfig.customBody,
        required: false,
        message: '自定义Body 标准JSON(eg: {"key":"value"})',
        alias: '自定义Body'
      }
    ]
  }

  return {
    uploader: 'web-uploader',
    register
  }
}
