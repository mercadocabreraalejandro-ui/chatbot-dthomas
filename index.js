const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const app = express();
const port = process.env.PORT || 3000;

let qrCodeData = ''; 
const usuariosEnProceso = {};
let botInstanciado = false; // Variable de control para evitar duplicar el bot al reconectar

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
                <p style="color:#444;">El servidor está escuchando los mensajes las 24 hours.</p>
            </div>
        `);
    }
});

app.listen(port, () => {
    console.log(`Servidor encendido en el puerto ${port}`);
});

async function iniciarBot() {
    // Si ya hay un bot corriendo, detenemos la creación de otro clon
    if (botInstanciado) return;
    botInstanciado = true;

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = qr;
            console.log('--- ¡NUEVO CÓDIGO QR GENERADO! Míralo en tu enlace de Render ---');
        }

        if (connection === 'close') {
            botInstanciado = false; // Permitimos que se cree una nueva conexión limpia
            const debeReconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (debeReconectar) iniciarBot();
        } else if (connection === 'open') {
            qrCodeData = '';
            console.log('🚀 ¡Felicidades! El chatbot de D\'Thomas está conectado perfectamente.');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        // SOLUCIÓN AL DUPLICADO: Extraemos estrictamente el primer mensaje real [0]
        const msg = m.messages[0];
        
        // Evitamos que responda si no hay mensaje, si es una notificación del sistema o si lo envió el bot
        if (!msg || !msg.message || msg.key.fromMe) return;
        
        // Evitamos responder a los estados / historias de WhatsApp
        if (msg.key.remoteJid === 'status@broadcast') return;

        const jid = msg.key.remoteJid;
        const textoCliente = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        
        const simularEscritura = ms => new Promise(res => setTimeout(res, ms));

        if (usuariosEnProceso[jid]) {
            const pasoActual = usuariosEnProceso[jid];
            await simularEscritura(3000);

            if (pasoActual === 'ESPERANDO_DATOS_DELIVERY') {
                await sock.sendMessage(jid, { text: `🎉 *¡Listo! Tu pedido ha sido procesado con éxito.* \n\nEl motorista de D'Thomas ya está preparando la ruta para llevar tu comida a domicilio. El tiempo estimado es de 30 a 45 minutos. \n\n¡Muchas gracias por ordenar con nosotros! 🛵🍔🔥` });
            } 
            else if (pasoActual === 'ESPERANDO_DATOS_BUSCAR') {
                await sock.sendMessage(jid, { text: `🎉 *¡Listo! Tu pedido está anotado en cocina.* \n\nEmpezaremos a prepararlo de una vez para que esté calientito y empacado cuando pases a buscarlo al local.\n\n¡Gracias por tu compra! 🛍️✨` });
            } 
            else if (pasoActual === 'ESPERANDO_DATOS_ALLA') {
                await sock.sendMessage(jid, { text: `🎉 *¡Listo! Tu mesa y pedido han sido reservados con éxito.* \n\nNuestros cocineros tienen tu orden lista en el sistema para marcharla. Nos vemos en breve en el restaurante.\n\n¡Buen provecho por adelantado! 🍽️🔥` });
            }

            delete usuariosEnProceso[jid];
            return;
        }

        if (textoCliente.toLowerCase().includes('pedido') && textoCliente.toLowerCase().includes('carta') && textoCliente.toLowerCase().includes('total')) {
            await simularEscritura(2500);
            await sock.sendMessage(jid, { text: `📝 *¡Hemos recibido el resumen de tu pedido!*\n\nPor favor, dinos cómo prefieres disfrutar tu comida. Responde con el *NÚMERO* de la opción:\n\n*5.* 🛵 Delivery / Servicio a domicilio\n*6.* 🛍️ Pasar a buscar / Para llevar\n*7.* 🍽️ Comer allá / En el restaurante` });
            return;
        }

        if (textoCliente === '5') {
            usuariosEnProceso[jid] = 'ESPERANDO_DATOS_DELIVERY';
            await simularEscritura(2000);
            await sock.sendMessage(jid, { text: `🛵 *¡Excelente, seleccionaste Delivery!*\n\nPor favor, envíanos los siguientes datos en *UN SOLO MENSAJE*:\n\n• *Nombre:* (Quién recibe)\n• *Dirección exacta:* (Calle, residencial o negocio de referencia)\n• *Método de pago:* (Efectivo o Tarjeta)` });
            return;
        }

        if (textoCliente === '6') {
            usuariosEnProceso[jid] = 'ESPERANDO_DATOS_BUSCAR';
            await simularEscritura(2000);
            await sock.sendMessage(jid, { text: `🛍️ *¡Perfecto, pasas a recoger por el local!*\n\nPor favor, envíanos los siguientes datos en un mensaje:\n\n• *Nombre:* (Para quién se anota la orden)\n• *Un humano te dirá aproximadamente a qué hora puedes pasar a recoger tu pedido.*\n• *Método de pago:* (Efectivo o Tarjeta al retirar)` });
            return;
        }

        if (textoCliente === '7') {
            usuariosEnProceso[jid] = 'ESPERANDO_DATOS_ALLA';
            await simularEscritura(2000);
            await sock.sendMessage(jid, { text: `🍽️ *¡Genial, te esperamos en el restaurante!*\n\nPor favor, confírmanos en un mensaje:\n\n• *Nombre:* (Para la reserva de la mesa)\n• *Número de personas:* (Cuántos los acompañan a comer)` });
            return;
        }

        if (isNaN(textoCliente) || textoCliente === '') {
            await simularEscritura(2500);
            await sock.sendMessage(jid, { text: `¡Hola! Bienvenido al asistente inteligente de *D'Thomas Restaurante* 🍔🔥\n\nPor favor, responde escribiendo únicamente el *NÚMERO* de la opción que necesitas:\n\n*1.* 📦 Ver menú y Armar mi pedido (Online)\n*2.* 🕒 Ver Horarios de apertura\n*3.* 📍 Ubicación exacta\n*4.* 📞 Hablar con un agente humano` });
        } 
        else if (textoCliente === '1') {
            await simularEscritura(2000);
            await sock.sendMessage(jid, { text: `🍔 *¡Excelente elección!*\n\nEntra a nuestro menú interactivo desde tu celular para elegir tus platos favoritos y calcular el total automáticamente:\n\n🔗 https://netlify.app \n\nAl finalizar, dale al botón de enviar orden y el sistema te regresará aquí con tu pedido organizado.` });
        } 
        else if (textoCliente === '2') {
            await simularEscritura(1500);
            await sock.sendMessage(jid, { text: `🕒 *Nuestros Horarios de Apertura:*\n\n• *Lunes:* 7:45 AM - 9:30 PM\n• *Martes a Viernes:* 7:00 AM - 10:00 PM\n• *Sábados y Domingos:* 7:00 AM - 4:00 PM` });
        } 
        else if (textoCliente === '3') {
            await simularEscritura(1500);
            await sock.sendMessage(jid, { text: `📍 *Nuestra Ubicación:*\nResidencial Luigi II, Av. República de Argentina, Santiago de los Caballeros.` });
        } 
        else if (textoCliente === '4') {
            await simularEscritura(1500);
            await sock.sendMessage(jid, { text: `🔔 *Entendido.* He notificado a nuestro equipo. Un agente humano revisará este chat en un momento para atenderte de forma personalizada. ¡Gracias por tu paciencia!` });
        } 
        else {
            await simularEscritura(1000);
            await sock.sendMessage(jid, { text: `❌ Esa opción no existe. Por favor, escribe un número del *1 al 4* según el menú anterior.` });
        }
    });
}

iniciarBot();
