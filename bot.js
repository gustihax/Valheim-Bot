const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js')
const sqlite3 = require('sqlite3').verbose()
const dotenv = require('dotenv')
const express = require('express')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.get('/', (req, res) => {
	res.send('Бот працює!')
})

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.DirectMessages,
	],
})

const db = new sqlite3.Database('schedule.db', err => {
	if (err) {
		console.error('Помилка при підключенні до бази даних:', err)
	} else {
		console.log('Підключено до бази даних')
		db.run(`CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT,
            author_id TEXT,
            date TEXT,
            time TEXT,
            description TEXT
        )`)
	}
})

client.once('ready', () => {
	console.log(`Бот ${client.user.tag} готовий до роботи!`)
	console.log(`Статус підключення: ${client.ws.status}`)
	console.log(`Пінг: ${client.ws.ping}ms`)

	client.user.setPresence({
		activities: [{ name: 'Valheim', type: 'PLAYING' }],
		status: 'online',
	})
})

client.on('error', error => {
	console.error('Помилка клієнта Discord:', error)
})

client.on('disconnect', () => {
	console.log('Бот відключився від Discord!')
})

client.on('reconnecting', () => {
	console.log('Бот намагається перепідключитися...')
})

client.on('messageCreate', async message => {
	if (message.author.bot || !message.content.startsWith('!')) return

	const args = message.content.slice(1).trim().split(/ +/)
	const command = args.shift().toLowerCase()

	switch (command) {
		case 'add_schedule':
			if (args.length < 3) {
				const helpEmbed = new EmbedBuilder()
					.setTitle('🎮 Планувальник подій Valheim')
					.setColor('#2b2d31')
					.setDescription('> Створіть нову подію, вказавши дату, час та опис')
					.addFields(
						{
							name: '⌨️ Формат команди',
							value: '```!add_schedule DD.MM.YYYY HH:MM[-HH:MM] Назва події```',
						},
						{
							name: '💡 Приклади',
							value:
								'```!add_schedule 07.12.2024 12:00-13:00 Рейд на Боса\n!add_schedule 07.12.2024 18:00 Збір ресурсів```',
						}
					)
				message.reply({ embeds: [helpEmbed] })
				return
			}

			const date = args[0]
			const timeInput = args[1]
			const description = args.slice(2).join(' ')
			const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/
			const singleTimeRegex = /^\d{2}:\d{2}$/
			const timeRangeRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/

			if (
				!dateRegex.test(date) ||
				(!singleTimeRegex.test(timeInput) && !timeRangeRegex.test(timeInput))
			) {
				const errorEmbed = new EmbedBuilder()
					.setTitle('❌ Помилка формату')
					.setColor('#ff4757')
					.setDescription('Неправильний формат дати або часу!')
					.addFields(
						{ name: '📅 Правильний формат дати', value: 'DD.MM.YYYY' },
						{
							name: '⏰ Правильний формат часу',
							value: 'HH:MM або HH:MM-HH:MM',
						},
						{
							name: '💡 Приклади',
							value: '07.12.2024 18:00\n07.12.2024 12:00-14:00',
						}
					)
				message.reply({ embeds: [errorEmbed] })
				return
			}

			const timeRange = singleTimeRegex.test(timeInput)
				? `${timeInput}-${timeInput}`
				: timeInput
			const [startTime, endTime] = timeRange.split('-')

			db.run(
				'INSERT INTO schedules (server_id, author_id, date, time, description) VALUES (?, ?, ?, ?, ?)',
				[message.guild.id, message.author.id, date, timeRange, description],
				function (err) {
					if (err) {
						message.reply('Помилка при додаванні розкладу!')
						return
					}

					const successEmbed = new EmbedBuilder()
						.setColor('#5865f2')
						.setAuthor({
							name: 'Нова подія додана до розкладу',
							iconURL: message.guild.iconURL(),
						})
						.setDescription(
							`
${getEventEmoji(description)} **Опис події:** ${description}

📅 \`${formatDate(date)}\`
⏰ \`${startTime === endTime ? startTime : `${startTime} - ${endTime}`}\`
👤 \`${message.author.username}\`
🔍 \`ID: #${this.lastID}\`
							`
						)
						.setFooter({
							text: 'Valheim Project • Система планування',
							iconURL: message.guild.iconURL(),
						})
						.setTimestamp()

					message.reply({ embeds: [successEmbed] })
				}
			)
			break

		case 'show_schedule':
			db.all(
				'SELECT * FROM schedules WHERE server_id = ? ORDER BY date, time',
				[message.guild.id],
				(err, rows) => {
					if (err) {
						message.reply('Помилка при отриманні розкладу!')
						return
					}

					if (rows.length === 0) {
						const emptyEmbed = new EmbedBuilder()
							.setTitle('🎮 Планувальник подій Valheim')
							.setColor('#2b2d31')
							.setDescription('> На даний момент немає запланованих подій')
							.addFields({
								name: '💡 Підказка',
								value:
									'Використайте команду `!add_schedule` щоб створити нову подію',
							})
							.setFooter({
								text: 'Valheim Project • Система планування',
								iconURL: message.guild.iconURL(),
							})
						message.reply({ embeds: [emptyEmbed] })
						return
					}

					const scheduleEmbed = new EmbedBuilder()
						.setColor('#5865f2')
						.setAuthor({
							name: 'Розклад подій Valheim',
							iconURL: message.guild.iconURL(),
						})
						.setDescription('Список усіх запланованих подій на сервері')

					rows.forEach(row => {
						const [startTime, endTime] = row.time.split('-')
						scheduleEmbed.addFields({
							name: `${getEventEmoji(row.description)} ${row.description}`,
							value: `> 📅 \`${formatDate(row.date)}\` • ⏰ \`${
								startTime === endTime ? startTime : `${startTime} - ${endTime}`
							}\`\n> 👤 Організатор: \`${
								message.author.username
							}\` • 🔍 \`ID: #${row.id}\``,
							inline: false,
						})
					})

					scheduleEmbed
						.setFooter({
							text: `Всього подій: ${rows.length} • Valheim Project`,
							iconURL: message.guild.iconURL(),
						})
						.setTimestamp()

					message.reply({ embeds: [scheduleEmbed] })
				}
			)
			break

		case 'delete_schedule':
			if (!args[0]) {
				message.reply('Використання: !delete_schedule <id>')
				return
			}

			const scheduleId = parseInt(args[0])
			db.run(
				'DELETE FROM schedules WHERE id = ? AND server_id = ?',
				[scheduleId, message.guild.id],
				function (err) {
					if (err) {
						message.reply('Помилка при видаленні розкладу!')
						return
					}

					if (this.changes > 0) {
						const deleteEmbed = new EmbedBuilder()
							.setColor('#00ff00')
							.setDescription(
								`${getEventEmoji(
									'success'
								)} **Подію успішно видалено**\n> 🔍 \`ID: #${scheduleId}\``
							)
							.setFooter({
								text: 'Valheim Project • Система планування',
								iconURL: message.guild.iconURL(),
							})

						message.reply({ embeds: [deleteEmbed] })
					} else {
						message.reply('Подію не знайдено!')
					}
				}
			)
			break

		case 'send_schedule':
			if (args.length < 2) {
				message.reply('Використання: !send_schedule @користувач <id>')
				return
			}

			const userId = args[0].replace(/[<@!>]/g, '')
			const scheduleIdToSend = parseInt(args[1])

			db.get(
				'SELECT * FROM schedules WHERE id = ? AND server_id = ?',
				[scheduleIdToSend, message.guild.id],
				async (err, row) => {
					if (err || !row) {
						message.reply('Подію не знайдено!')
						return
					}

					try {
						const user = await client.users.fetch(userId)
						const sendEmbed = new EmbedBuilder()
							.setColor('#5865f2')
							.setAuthor({
								name: row.description,
								iconURL: message.guild.iconURL(),
							})
							.setDescription(
								`
${getEventEmoji(row.description)} **Деталі події:**

📅 \`${formatDate(row.date)}\`
⏰ \`${row.time}\`
👤 \`${message.author.username}\`
🔍 \`ID: #${row.id}\`
							`
							)
							.setFooter({
								text: 'Valheim Project • Система планування',
								iconURL: message.guild.iconURL(),
							})
							.setTimestamp()

						await user.send({ embeds: [sendEmbed] })
						message.reply(`✅ Розклад надіслано користувачу ${user.tag}!`)
					} catch (error) {
						message.reply('❌ Не вдалося надіслати повідомлення користувачу.')
					}
				}
			)
			break
	}
})

function getEventEmoji(description) {
	description = description.toLowerCase()
	if (description.includes('рейд')) return '⚔️'
	if (description.includes('модер')) return '🐉'
	if (description.includes('ельдер')) return '🌳'
	if (description.includes('боун')) return '💀'
	if (description.includes('мудер')) return '🧙‍♀️'
	if (description.includes('ямглінг')) return '��'
	if (description.includes('бос')) return '👑'
	if (description.includes('фарм')) return '⛏️'
	if (description.includes('збір')) return '🎒'
	if (description.includes('будів')) return '🏗️'
	if (description.includes('база')) return '🏰'
	if (description.includes('подорож')) return '🚶'
	if (description.includes('експедиція')) return '��️'
	if (description.includes('корабель')) return '⛵'
	if (description.includes('риболовля')) return '🎣'
	if (description.includes('полювання')) return '🏹'
	return '🎮'
}

function formatDate(date) {
	const [day, month, year] = date.split('.')
	const months = {
		'01': 'Січня',
		'02': 'Лютого',
		'03': 'Березня',
		'04': 'Квітня',
		'05': 'Травня',
		'06': 'Червня',
		'07': 'Липня',
		'08': 'Серпня',
		'09': 'Вересня',
		10: 'Жовтня',
		11: 'Листопада',
		12: 'Грудня',
	}
	return `${day} ${months[month]} ${year}`
}

app.listen(PORT, () => {
	console.log(`Сервер запущено на порту ${PORT}`)
})

client.login(process.env.DISCORD_TOKEN)

client.on('debug', info => {
	console.log('Debug:', info)
})
