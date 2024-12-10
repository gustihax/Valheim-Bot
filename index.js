require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')
const bot = require('./bot')
const keepAlive = require('./keep_alive')

const token =
	process.env.DISCORD_TOKEN ||
	(process.env.REPL_OWNER ? process.env.REPLIT_TOKEN : null)

if (!token) {
	console.error(
		'❌ Discord token not found! Please set DISCORD_TOKEN in environment variables.'
	)
	process.exit(1)
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageReactions,
	],
})

client.on('error', error => {
	console.error('Discord client error:', error)
})

process.on('unhandledRejection', error => {
	console.error('Unhandled promise rejection:', error)
})

client.once('ready', async () => {
	try {
		const commands = [
			{
				name: 'add_schedule',
				description: 'Додати нові події до розкладу',
				options: [
					{
						name: 'events',
						description:
							'Події у форматі: DD.MM.YYYY HH:MM[-HH:MM] Н��зва; [наступна подія]',
						type: 3, // STRING
						required: true,
					},
				],
			},
			{
				name: 'show_schedule',
				description: 'Показати список всіх запланованих подій',
			},
			{
				name: 'delete_schedule',
				description: 'Видалити подію за ID',
				options: [
					{
						name: 'id',
						description: 'ID події',
						type: 4, // INTEGER
						required: true,
					},
				],
			},
			{
				name: 'send_schedule',
				description: 'Надіслати подію користувачу',
				options: [
					{
						name: 'user',
						description: 'Користувач',
						type: 6, // USER
						required: true,
					},
					{
						name: 'id',
						description: 'ID події',
						type: 4, // INTEGER
						required: true,
					},
				],
			},
		]

		await client.application.commands.set(commands)
		console.log('✅ Slash commands registered')
		console.log(`🤖 ${client.user.tag} is online!`)
	} catch (error) {
		console.error('Error registering commands:', error)
	}
})

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return

	try {
		switch (interaction.commandName) {
			case 'add_schedule':
				const eventsInput = interaction.options.getString('events')
				await bot.handleMultipleSchedules(interaction, eventsInput)
				break
			case 'show_schedule':
				await bot.handleShowSchedule(interaction)
				break
			case 'delete_schedule':
				await bot.handleDeleteSchedule(
					interaction,
					interaction.options.getInteger('id')
				)
				break
			case 'send_schedule':
				await bot.handleSendSchedule(
					interaction,
					interaction.options.getUser('user'),
					interaction.options.getInteger('id')
				)
				break
			default:
				await interaction.reply({
					content: 'Невідома команда',
					ephemeral: true,
				})
		}
	} catch (error) {
		console.error('Command execution error:', error)
		try {
			const reply = {
				content: 'Виникла помилка при виконанні команди',
				ephemeral: true,
			}

			if (interaction.deferred || interaction.replied) {
				await interaction.editReply(reply)
			} else {
				await interaction.reply(reply)
			}
		} catch (e) {
			console.error('Error sending error message:', e)
		}
	}
})

client.on('messageCreate', async message => {
	if (message.content.startsWith('!add_schedule')) {
		await message.reply({
			content:
				'❌ Цей бот використовує slash-команди!\n' +
				'Використовуйте `/add_schedule` замість `!add_schedule`\n\n' +
				'Приклад:\n' +
				'`/add_schedule date:10.12.2024 time:20:30-21:00 title:Рейд на боса`',
			ephemeral: true,
		})
	}
})

client.on('interactionCreate', async interaction => {
	if (!interaction.isAutocomplete()) return

	if (interaction.commandName === 'add_schedule') {
		if (interaction.options.getFocused(true).name === 'date') {
			try {
				const dates = []
				const today = new Date()

				for (let i = 0; i < 30; i++) {
					const date = new Date()
					date.setDate(today.getDate() + i)

					const day = String(date.getDate()).padStart(2, '0')
					const month = String(date.getMonth() + 1).padStart(2, '0')
					const year = date.getFullYear()

					const formattedDate = `${day}.${month}.${year}`

					dates.push({
						name: formattedDate,
						value: formattedDate,
					})
				}

				const focusedValue = interaction.options.getFocused()
				const filtered = dates.filter(date =>
					date.name.startsWith(focusedValue)
				)

				if (!interaction.responded) {
					await interaction.respond(filtered.slice(0, 25))
				}
			} catch (error) {
				console.error('Autocomplete error:', error)
			}
		}
	}
})

keepAlive()

client.login(token).catch(error => {
	console.error('Failed to login:', error)
	process.exit(1)
})
