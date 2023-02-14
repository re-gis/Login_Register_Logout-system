const nodeMailer = require('nodemailer')


const sendEmail = async(email, subject, text) => {
    try {
        const transporter = nodeMailer.createTransport({
            service: process.env.SERVICE,
            port: 587,
            secure: true,
            auth: {
                user: process.env.USER,
                pass: process.env.PASS
            }
        })

        await transporter.sendMail({
            from: process.env.USER,
            to: email,
            subject: subject,
            text: text
        })
    } catch (err) {
        console.log(err);
        console.log('Email not sent!');
    }
}

module.exports = {
    sendEmail,
}