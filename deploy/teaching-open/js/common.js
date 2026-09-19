window.version = 'TO2.8'
window.urlParams = function (paramName) {
  var reg = new RegExp('[?&]' + paramName + '=([^&]*)[&]?', 'i')
  var paramVal = window.location.search.match(reg)
  if(paramVal == null) return ''
  var param = paramVal[1].replace(/%/g,'%25');
  return decodeURIComponent(param)
}

window.uuid = function() {
  var s = []
  var hexDigits = '0123456789abcdef'
  for (var i = 0; i < 36; i++) {
    s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1)
  }
  s[14] = '4' // bits 12-15 of the time_hi_and_version field to 0010
  s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1) // bits 6-7 of the clock_seq_hi_and_reserved to 01
  s[8] = s[13] = s[18] = s[23] = '-'
  var uuid = s.join('')
  return uuid
}


window.getUserInfo = function() {
  userInfo = localStorage.getItem('pro__Login_Userinfo')
  if(!userInfo){ return {};}
    userInfo = JSON.parse(userInfo).value
    return userInfo
}

window.getUserRole = function(){
  userRole = localStorage.getItem('pro__Login_UserRole')
  if(!userRole){return {};}
    userRole = JSON.parse(userRole).value
    return userRole
}

window.getUserToken = function() {
  if(!localStorage.getItem("pro__Access-Token")) return null;
  var token = JSON.parse(localStorage.getItem("pro__Access-Token"))
  return token==null?null:token.value
}

window.getSysConfig = function(key){
  if(localStorage.getItem("pro__SYS_CONFIG") && JSON.parse(localStorage.getItem("pro__SYS_CONFIG")).value){
    return JSON.parse(localStorage.getItem("pro__SYS_CONFIG")).value[key]
  }else{
    let config = null
    $.ajax({
      url: '/api/sys/config/getCurrentConfig',
      async: false,
      success: function(res){
        if(res.code == 0){
          config = res.result
          let configCache = {
            expire: new Date().getTime()+3600000,
            value: config
          }
          localStorage.setItem("pro__SYS_CONFIG", JSON.stringify(configCache))
        }
      }
    })
    return config ? config[key] : undefined
  }
}

window.getLogo = function(){
  if(getSysConfig('uploadType') == "qiniu"){
  return getSysConfig('qiniuDomain') + "/" + getSysConfig('logo')
  }else{
    return getSysConfig('staticDomain') + "/" + getSysConfig('logo')
  }
}

window.getWorkInfo = function(workId, cb) {
  $.ajax({
    url: '/api/teaching/teachingWork/studentWorkInfo',
    data: { workId: workId },
    success: function (res) {
      if (res.code == 0) {
        cb(res.result)
      }
    },
    error: function (e) {
    }
  })
}

//获取Scratch素材库  1背景 2声音 3造型 4角色
window.getScratchAssets = function(assetType, cb){
  let data;
  $.ajax({
    url: '/api/teaching/teachingScratchAssets/getScratchAssets?assetType='+assetType,
    beforeSend: function (request) {
      request.setRequestHeader('X-Access-Token', getUserToken())
    },
    async: cb!=undefined,
    success: function (res) {
      if(cb){
        cb(res)
      }else{
        data = res
      }
    },
  });
  return data
}

window.getQiniuToken = function(onSuccess, onError) {
  var qn_token;
  $.ajax({
    url: '/api/common/qiniu/getToken?t=' + new Date().getTime(),
    beforeSend: function(request) {
      request.setRequestHeader('X-Access-Token', getUserToken())
    },
    async: false,
    success: function(res) {
      if (res.code == 200) {
        qn_token = res.result
        if (onSuccess) {
          onSuccess(res)
        }
      } else {
        //alert(res.message)
      }
    },
    error: function(e) {
      if (onError) {
        onError(e)
      }
    }
  });
  return qn_token;
}


  //上传文件
  function uploadFile(fileName, fileTag, filePath, fileLocation) {
    var id = null;
    $.ajax({
      url: '/api/system/sysFile/add',
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      async: false,
      beforeSend: function (request) {
        request.setRequestHeader('X-Access-Token', getUserToken())
      },
      data: JSON.stringify({
        fileType: 2,
        fileName: fileName,
        filePath: filePath,
        fileLocation: fileLocation,
        fileTag: fileTag
      }),
      success: function (res) {
        if (res.success) {
          id = res.result.id
        }
      },
      error: function () {
      },
      complete: function () {
      }
    })
    return id;
  }

  function getUnitInfo(unitId, cb){
    $.ajax({
      url: '/api/teaching/teachingCourseUnit/getUnitWorkInfo',
      data: {
        unitId: unitId
      },
      beforeSend: function(request) {
        request.setRequestHeader('X-Access-Token', getUserToken())
      },
      success: function(res) {
        
        if (res.success) {
          cb(res.result)
        } else {
          alert("老师还没有上传作业文件")
        }
      },
      error: function(e) {
        if (e.responseJSON.status == 500) {}
      }
    })
  }

  
  function upload2Qiniu(file, key, fileName, observer) {
    // qiniu.min.js (v2.x) 的 region 字典只有 z0/z1/z2/na0/as0,而后端 sysConfig.qiniuArea
    // 可能是七牛新区域名(如 cn-east-2),不在字典里。旧做法用 region 字典 key,未知区域
    // 回退 z0 —— 但 bucket 实际在 cn-east-2,用 z0 的上传域名会被七牛拒(400 bad request,
    // "no such bucket")。七牛上传域名按 bucket 所在区域分配,规则为 upload-{area}.qiniup.com。
    // getUploadUrl 优先读 config.uphost(直接用),其次 config.region(查字典)。所以对未知
    // 区域直接给 uphost,绕过字典;对已知区域仍走 region 字典。
    var qiniuArea = getSysConfig('qiniuArea') || '';
    var config = {
      useCdnDomain: true,
      disableStatisticsReport: true
    };
    if (qiniu.region[qiniuArea]) {
      config.region = qiniu.region[qiniuArea];
    } else if (qiniuArea) {
      // cn-east-2 / cn-north-1 等新区域:直接指定上传域名(规则 upload-{area}.qiniup.com)
      config.uphost = 'upload-' + qiniuArea + '.qiniup.com';
    } else {
      // sysConfig 无 qiniuArea,回退华东
      config.region = qiniu.region.z0;
    }
    var putExtra = {
      fname: fileName, //文件原名
      params: {},
      mimeType: null
    }
    var observable = qiniu.upload(file, key, qn_token, putExtra, config)
    var subscription = observable.subscribe(observer)
  }

  function update2Local(file,filename,bizPath, cb){
    let uploadApi = JSON.parse(localStorage.getItem("CONFIG")).domianURL+"/sys/common/upload"

    var formData = new FormData();
    formData.append("file",file, filename);
    formData.append("bizPath",bizPath);

    $.ajax({
      url: uploadApi,
      type: 'POST',
      cache: false,
      data: formData,
      processData: false,
      contentType: false,
      beforeSend: function(request) {
        request.setRequestHeader('X-Access-Token', getUserToken())
      },
      success: function (result) {
        if(cb){
          cb(result)
        }
      },
      error: function (err) {
        alert("文件上传失败")
      }
    })

  }

function createCode(id, src) {
  $('#' + id).html('')
  var qrcode = new QRCode(document.getElementById(id), {
    width: 250,
    height: 250
  })
  qrcode.makeCode(src)
}

function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function getFileAccessHttpUrl(avatar,subStr) {
  if(!subStr) subStr = 'https'
  if(avatar && avatar.startsWith(subStr)){
    return avatar;
  }else{
    if(avatar &&　avatar.length>0 && avatar.indexOf('[')==-1){
      if(getSysConfig('uploadType') == "qiniu"){
        return getSysConfig('qiniuDomain') + '/' + avatar;
      }else{
        return getSysConfig('staticDomain') + '/' + avatar;
      }
    }
  }
}

//请求全屏
window.launchIntoFullscreen = function(element) {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
}

//退出全屏
window.exitFullscreen = function() {
  if (window.document.exitFullscreen && window.isFullscreen()) {
    window.document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    window.document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    window.document.webkitExitFullscreen();
  }
}

window.onresize = function () {
  if (!window.isFullscreen()) {
    // 要执行的动作
    // 按下了Esc;
  }
}


//是否全屏
window.isFullscreen = function(){
  return document.fullscreenElement    ||
         document.msFullscreenElement  ||
         document.mozFullScreenElement ||
         document.webkitFullscreenElement || false;
}

// 蓝趣编程课堂 v2.8;

window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-HPJJESN3X4');

var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?50e7486025ea62b7c0e8198e0436f80e";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();