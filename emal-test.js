const amqp = require('amqplib');

async function sendTestEmail() {
  try {
    const connection = await amqp.connect(
      'amqp://adTdgQXQfnuCeyUJ:ZdsYLhbIOhdSky1g-MDAqY67hsI~E4JN@shinkansen.proxy.rlwy.net:43969',
    );
    const channel = await connection.createChannel();

    const queue = 'email.queue';
    await channel.assertQueue(queue, { durable: true });

    const testMessage = {
      request_id: `test-${Date.now()}`,
      to: 'recipient@example.com',
      from: 'sender@example.com',
      subject: 'Test Email from RabbitMQ',
      body: 'This is a test message',
      html: '<p>This is a <strong>test</strong> message</p>',
    };

    channel.sendToQueue(queue, Buffer.from(JSON.stringify(testMessage)), {
      persistent: true,
    });

    console.log(`✅ Sent test message: ${testMessage.request_id}`);

    setTimeout(() => {
      connection.close();
      process.exit(0);
    }, 500);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

sendTestEmail();
