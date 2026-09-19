(function(){
  const sameOrigin=typeof location!=='undefined' && /^https?:$/.test(location.protocol);
  window.MORDHEIMUNDA_CONFIG=Object.assign({apiBaseUrl:sameOrigin?location.origin:'',storageMode:'cloud',appVersion:'26-V88'},window.MORDHEIMUNDA_CONFIG||{});
})();
