
import qrcode from 'qrcode';

export const displayQrCode = async (url: string) => {
  try {
    const terminalQR = await qrcode.toString(url, {
      type: 'terminal',
      small: true,
      color: {
        dark: '#000',
        light: '#FFF'
      }
    });
    console.log('📱 Connect with the developer:');
    console.log(terminalQR);
  } catch (err) {
    console.error('Error generating QR code');
  }
};
