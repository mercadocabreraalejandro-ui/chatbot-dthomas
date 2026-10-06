const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const app = express();
const port = process.env.PORT || 3000;

let qrCodeData = ''; // Variable global para guardar el texto del QR

// 1. Servidor Web Express para ver el código QR en el navegador
app.get('/', (req, res) => {
    if (qrCodeData) {
        qrcode.toDataURL(qrCodeData, (err, url) => {
            res.send(`
                <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                    <h2 style="color:#333;">Escanea este código QR con el WhatsApp de D'Thomas</h2>
                    <img src="${url}" alt="Código QR de WhatsApp" style="border: 2px solid #333; padding:15px; border-radius:10px; width:300px;"/>
                    <p style="color:#666; margin-top:15px;">Por seguridad, actualiza la página si el código cambia o expira.</p>
                </div>
            `);
        });
    } else {
        res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:100px;">
                <h1 style="color:green;">✅ ¡El Chatbot de WhatsApp está ACTIVO y Conectado!</h1>
                <p style="color:#444;">El servidor está escuchando los mensajes las 24 horas.</p>
            </div>
        `);
    }
});

app.listen(port, () => {
    console.log(`Servidor encendido en el puerto ${port}`);
});

// 2. Iniciar la conexión de WhatsApp sin necesidad de Chrome / Puppeteer
async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }), // Apaga los logs molestos en consola
        auth: state,
        printQRInTerminal: false
    });

    // Guardar credenciales de sesión automáticamente al escanear
    sock.ev.on('creds.update', saveCreds);

    // Escuchar el estado de la conexión e hilos de QR
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = qr; // Guardamos el código QR generado
            console.log('--- ¡NUEVO CÓDIGO QR GENERADO! Míralo en tu enlace de Render ---');
        }

        if (connection === 'close') {
            const debeReconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. ¿Reconectando?:', debeReconectar);
            if (debeReconectar) iniciarBot(); // Si se cae la red, se reconecta solo
        } else if (connection === 'open') {
            qrCodeData = ''; // Borramos el QR porque ya se conectó
            console.log('🚀 ¡Felicidades! El chatbot de D\'Thomas está conectado perfectamente.');
        }
    });

    // 3. Cerebro del menú interactivo (Escuchador de mensajes recibidos)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return; // Ignorar si no tiene texto o si el mensaje lo mandó el bot

        const jid = msg.key.remoteJid;
        // Obtener el texto del mensaje ya sea de un chat normal o una respuesta extendida
        const textoCliente = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        
        const simularEscritura = ms => new Promise(res => setTimeout(res, ms));

        // Si el mensaje NO es un número (es un saludo)
        if (isNaN(textoCliente) || textoCliente === '') {
            await simularEscritura(2500);
            await sock.sendMessage(jid, { text: 
                `¡Hola! Bienvenido al asistente inteligente de *D'Thomas Restaurante* 🍔🔥\n\n` +
                `Por favor, responde escribiendo únicamente el *NÚMERO* de la opción que necesitas:\n\n` +
                `*1.* 📦 Ver menú y Armar mi pedido (Online)\n` +
                `*2.* 🕒 Ver Horarios de apertura\n` +
                `*3.* 📍 Ubicación exacta\n` +
                `*4.* 📞 Hablar con un agente humano`
            });
        } 
        // Opción 1: Enlace de tu menú web
        else if (textoCliente === '1') {
            await simularEscritura(2000);
            await sock.sendMessage(jid, { text: 
                `🍔 *¡Excelente elección!*\n\n` +
                `Entra a nuestro menú interactivo desde tu celular para elegir tus platos favoritos y calcular el total automáticamente:\n\n` +
                `🔗 https://dthomasmenu.netlify.app/ \n\n` +
                `Al finalizar, dale al botón de enviar orden y el sistema te regresará aquí con tu pedido organizado.`
            });
        } 
        // Opción 2: Horarios
        else if (textoCliente === '2') {
            await simularEscritura(1500);
            await sock.sendMessage(jid, { text: `🕒 *D'Thomas Restaurante:*\nEstamos abiertos los lunes de *7:45AM a 9:30PM*.\n *De martes a viernes de *7:00AM a 10:00AM*\n *Los sabados y domingos de *7:00AM a 4:00PM* ¡Te esperamos!` });
        } 
        // Opción 3: Ubicación
        else if (textoCliente === '3') {
            await simularEscritura(1500);
            await sock.sendMessage(jid, { text: `📍 *Nuestra Ubicación:*\nResidencial Luigi II, Av. República de Argentina, Santiago de los Caballeros.` });
        } 
        // Opción 4: Soporte
        else if (textoCliente === '4') {
            await simularEscritura(1500);
            await sock.sendMessage(jid, { text: `🔔 *Entendido.* He notificado a nuestro equipo. Un agente humano revisará este chat en un momento para atenderte de forma personalizada. ¡Gracias por tu paciencia!` });
        } 
        // Opción inválida
        else {
            await simularEscritura(1000);
            await sock.sendMessage(jid, { text: `❌ Esa opción no existe. Por favor, escribe un número del *1 al 4* según el menú anterior.` });
        }
    });
}

iniciarBot();
