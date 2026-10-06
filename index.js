const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const app = express();
const port = process.env.PORT || 3000;

let qrCodeData = ''; // Variable global para guardar el texto del QR

// Base de datos temporal en memoria para recordar en qué paso va cada cliente
const usuariosEnProceso = {};

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
            const debeReconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (debeReconectar) iniciarBot();
        } else if (connection === 'open') {
            qrCodeData = '';
            console.log('🚀 ¡Felicidades! El chatbot de D\'Thomas está conectado perfectamente.');
        }
    });

    // 3. Cerebro del menú interactivo (Escuchador de mensajes recibidos)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const textoCliente = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        
        const simularEscritura = ms => new Promise(res => setTimeout(res, ms));

        // ==========================================
        // DETECTOR DE ESTADO FINAL: CAPTURAR DATOS
        // ==========================================
        if (usuariosEnProceso[jid]) {
            const pasoActual = usuariosEnProceso[jid];
            
            await simularEscritura(3000); // Simula escribir por 3 segundos

            if (pasoActual === 'ESPERANDO_DATOS_DELIVERY') {
                await sock.sendMessage(jid, { text: 
                    `🎉 *¡Listo! Tu pedido ha sido procesado con éxito.* \n\n` +
                    `El motorista de D'Thomas ya está preparando la ruta para llevar tu comida a domicilio. El tiempo estimado de entrega es de 30 a 45 minutos. \n\n` +
                    `¡Muchas gracias por ordenar con nosotros! 🛵🍔🔥`
                });
            } 
            else if (pasoActual === 'ESPERANDO_DATOS_BUSCAR') {
                await sock.sendMessage(jid, { text: 
                    `🎉 *¡Listo! Tu pedido está anotado en cocina.* \n\n` +
                    `Empezaremos a prepararlo de una vez para que esté calientito y empacado cuando pases a buscarlo al local.\n\n` +
                    `¡Gracias por tu compra! 🛍️✨`
                });
            } 
            else if (pasoActual === 'ESPERANDO_DATOS_ALLA') {
                await sock.sendMessage(jid, { text: 
                    `🎉 *¡Listo! Tu mesa y pedido han sido reservados con éxito.* \n\n` +
                    `Nuestros cocineros tienen tu orden lista en el sistema para marcharla. Nos vemos en breve en el restaurante.\n\n` +
                    `¡Buen provecho por adelantado! 🍽️🔥`
                });
            }

            // Una vez enviado el mensaje de éxito, borramos al usuario del registro
            delete usuariosEnProceso[jid];
            return; // Detiene el código para que no se repitan menús
        }

        // ==========================================
        // TRUCO DETECTOR DE LA PÁGINA (Petición Inicial)
        // ==========================================
        if (textoCliente.toLowerCase().includes('pedido') || textoCliente.toLowerCase().includes('carta')) {
            await simularEscritura(2500);
            await sock.sendMessage(jid, { text: 
                `📝 *¡Hemos recibido el resumen de tu pedido!*\n\n` +
                `Por favor, dinos cómo prefieres disfrutar tu comida. Responde con el *NÚMERO* de la opción:\n\n` +
                `*5.* 🛵 Delivery / Servicio a domicilio\n` +
                `*6.* 🛍️ Pasar a buscar / Para llevar\n` +
                `*7.* 🍽️ Comer allá / En el restaurante`
            });
            return;
        }

        // ==========================================
        // SELECCIÓN DE MODALIDAD Y CONFIGURAR ESTADO
        // ==========================================
        if (textoCliente === '5') {
            usuariosEnProceso[jid] = 'ESPERANDO_DATOS_DELIVERY'; // El bot activa su memoria
            await simularEscritura(2000);
            await sock.sendMessage(jid, { text:
                `🛵 *¡Excelente, seleccionaste Delivery!*\n\n` +
                `Por favor, envíanos los siguientes datos en *UN SOLO MENSAJE*:\n\n` +
                `• *Nombre:* (Quién recibe)\n` +
                `• *Dirección exacta:* (Calle, residencial o negocio de referencia)\n` +
                `• *Método de pago:* (Efectivo -indica con cuánto pagas- o Transferencia)`
            });
            return;
        }

        if (textoCliente === '6') {
            usuariosEnProceso[jid] = 'ESPERANDO_DATOS_BUSCAR'; // El bot activa su memoria
            await simularEscritura(2000);
            await sock.sendMessage(jid, { text:
                `🛍️ *¡Perfecto, pasas a recoger por el local!*\n\n` +
                `Por favor, envíanos los siguientes datos en un mensaje:\n\n` +
                `• *Nombre:* (Para quién se anota la orden)\n` +
                `• *Hora estimada:* (A qué hora pasarás por el local)\n` +
                `• *Método de pago:* (Efectivo o Transferencia al retirar)`
            });
            return;
        }

        if (textoCliente === '7') {
            usuariosEnProceso[jid] = 'ESPERANDO_DATOS_ALLA'; // El bot activa su memoria
            await simularEscritura(2000);
            await sock.sendMessage(jid, { text:
                `🍽️ *¡Genial, te esperamos en el restaurante!*\n\n` +
                `Por favor, confírmanos en un mensaje:\n\n` +
                `• *Nombre:* (Para la reserva de la mesa)\n` +
                `• *Número de personas:* (Cuántos los acompañan a comer)`
            });
            return;
        }

        // ==========================================
        // SISTEMA DEL MENÚ NUMÉRICO INICIAL NORMAL
        // ==========================================
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
        else if (textoCliente === '1') {
            await simularEscritura(2000);
            await sock.sendMessage(jid, { text: 
                `🍔 *¡Excelente elección!*\n\n` +
                `Entra a nuestro menú interactivo desde tu celular para elegir tus platos favoritos y calcular el total automáticamente:\n\n` +
                `🔗 https://netlify.app \n\n` +
                `Al finalizar, dale al botón de enviar orden y el sistema te regresará aquí con tu pedido organizado.`
            });
        } 
        else if (textoCliente === '2') {
            await simularEscritura(1500);
            await sock.sendMessage(jid, { text: 
                `🕒 *Nuestros Horarios de Apertura:*\n\n` +
                `• *Lunes:* 7:45 AM - 9:30 PM\n` +
                `• *Martes a Viernes:* 7:00 AM - 10:00 PM\n` +
                `• *Sábados y Domingos:* 7:00 AM - 4:00 PM` 
            });
        } 
        else if (textoCliente === '3') {
            await simularEscritura(1500);
            await sock.sendMessage(jid, { text: `📍 *Nuestra Ubicación:*\nResidencial Luigi II, Av. República de Argentina, Santiago de los Caballeros.` });
        } 
        else if (textoCliente === '4') {
            await simularEscritura(1500);
