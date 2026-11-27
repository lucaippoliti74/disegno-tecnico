'use strict';
{
  const endpoint = window.CT_ENDPOINT;
  if (endpoint) {
    const encode = blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    window.CTApi = async (prompt, {images, tier, signal, token}) => {
      if (images.some(image => image.size > 1024 * 1024)) {
        throw {code: 'prompt_too_large'};
      }
      const encoded = await Promise.all(images.map(encode));
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
        headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        body: JSON.stringify({prompt, images: encoded, tier}),
        signal,
      });
      const body = await response.json();
      if (!response.ok) throw {code: body.error};
      return body.result;
    };
  }
}
