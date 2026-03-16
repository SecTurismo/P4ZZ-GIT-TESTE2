import { getAppSettings } from './storage';

let audioInstance: HTMLAudioElement | null = null;

const DEFAULT_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2431/2431-preview.mp3';

export const playSaleConfirmationSound = async () => {
  try {
    const settings = await getAppSettings();
    
    if (settings.saleConfirmationSoundEnabled === false) return;

    let soundUrl = settings.saleConfirmationSoundUpload || settings.saleConfirmationSoundUrl;
    
    // Se ambos estiverem vazios, usa o padrão
    if (!soundUrl || soundUrl.trim() === '') {
      soundUrl = DEFAULT_SOUND_URL;
    }

    if (audioInstance) {
      audioInstance.pause();
      // Não resetamos currentTime aqui se vamos mudar o src, o load() já cuida disso
    } else {
      audioInstance = new Audio();
    }

    // Normalizar a URL para comparação (src do Audio é sempre absoluta)
    const absoluteUrl = soundUrl.startsWith('data:') ? soundUrl : new URL(soundUrl, window.location.href).href;

    if (audioInstance.src !== absoluteUrl) {
      audioInstance.src = absoluteUrl;
      audioInstance.load();
    } else {
      audioInstance.currentTime = 0;
    }

    await audioInstance.play();
  } catch (error) {
    // Silencia erros de autoplay ou carregamento para não travar a UI
    console.warn('Aviso ao reproduzir som de venda:', error);
  }
};

export const preloadSaleSound = async () => {
  try {
    const settings = await getAppSettings();
    let soundUrl = settings.saleConfirmationSoundUpload || settings.saleConfirmationSoundUrl;
    
    if (!soundUrl || soundUrl.trim() === '') {
      soundUrl = DEFAULT_SOUND_URL;
    }
    
    const absoluteUrl = soundUrl.startsWith('data:') ? soundUrl : new URL(soundUrl, window.location.href).href;

    if (!audioInstance) {
      audioInstance = new Audio(absoluteUrl);
    } else if (audioInstance.src !== absoluteUrl) {
      audioInstance.src = absoluteUrl;
    }
    audioInstance.load();
  } catch (error) {
    console.warn('Aviso ao pré-carregar som de venda:', error);
  }
};
