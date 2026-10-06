const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

let qrCodeData = ''; // Variable global donde guardamos el texto del QR

// 1. Servidor Web Express para ver el código QR en el navegador
app.get('/', (req, res) => {
    if (qrCodeData) {
        // Si hay un QR activo, lo convierte en una imagen visible en HTML
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
    console.log(`Entra al enlace de Render para escanear el código QR`);
});

// 2. Configuración del cliente de WhatsApp (Limpiado para que busque el Chrome interno de Render)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        // Dejamos que Puppeteer busque solo el navegador descargado automáticamente en el proyecto
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Escucha cuando WhatsApp genera un nuevo código de vinculación
client.on('qr', (qr) => {
    qrCodeData = qr;
    console.log('--- ¡NUEVO CÓDIGO QR GENERADO! Míralo en tu enlace de Render ---');
});

// Escucha cuando el celular se vincula con éxito
client.on('ready', () => {
    qrCodeData = ''; // Borramos el QR de la página web porque ya se conectó
    console.log('🚀 ¡Felicidades! El chatbot está en línea y funcionando perfectamente.');
});

// 3. Cerebro del menú interactivo numérico (Con retraso anti-bloqueo)
client.on('message', async (msg) => {
    const mensajeCliente = msg.body.trim();

    // Función interna para simular escritura humana (espera en milisegundos)
    const simularEscritura = ms => new Promise(res => setTimeout(res, ms));

    // Si el mensaje recibido NO es un número (es un saludo o texto cualquiera)
    if (isNaN(mensajeCliente)) {
        await simularEscritura(2500); // Simula escribir por 2.5 segundos
        await client.sendMessage(msg.from, 
            `¡Hola! Bienvenido al asistente inteligente de *D'Thomas Restaurante* 🍔🔥\n\n` +
            `Por favor, responde escribiendo únicamente el *NÚMERO* de la opción que necesitas:\n\n` +
            `*1.* 📦 Ver menú y Armar mi pedido (Online)\n` +
            `*2.* 🕒 Ver Horarios de apertura\n` +
            `*3.* 📍 Ubicación exacta\n` +
            `*4.* 📞 Hablar con un agente humano`
        );
    } 
    // Opción 1: Enlace a tu menú de Netlify
    else if (mensajeCliente === '1') {
        await simularEscritura(2000);
        await client.sendMessage(msg.from, 
            `🍔 *¡Excelente elección!*\n\n` +
            `Entra a nuestro menú interactivo desde tu celular para elegir tus platos favoritos y calcular el total automáticamente:\n\n` +
            `🔗 https://netlify.app \n\n` +
            `Al finalizar, dale al botón de enviar orden y el sistema te regresará aquí con tu pedido organizado.`
        );
    } 
    // Opción 2: Ver horarios
    else if (mensajeCliente === '2') {
        await simularEscritura(1500);
        await client.sendMessage(msg.from, `🕒 *D'Thomas Restaurante:*\nEstamos abiertos todos los días de *11:30 AM a 10:00 PM*. ¡Te esperamos!`);
    } 
    // Opción 3: Ubicación física
    else if (mensajeCliente === '3') {
        await simularEscritura(1500);
        await client.sendMessage(msg.from, `📍 *Nuestra Ubicación:*\nResidencial Luigi II, Av. República de Argentina, Santiago de los Caballeros.`);
    } 
    // Opción 4: Soporte humano
    else if (mensajeCliente === '4') {
        await simularEscritura(1500);
        await client.sendMessage(msg.from, `🔔 *Entendido.* He notificado a nuestro equipo. Un agente humano revisará este chat en un momento para atenderte de forma personalizada. ¡Gracias por tu paciencia!`);
    } 
    // Si meten cualquier otra opción numérica inválida (ejemplo: 5)
    else {
        await simularEscritura(1000);
        await client.sendMessage(msg.from, `❌ Esa opción no existe. Por favor, escribe un número del *1 al 4* según el menú anterior.`);
    }
});

client.initialize();
