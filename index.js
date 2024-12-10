require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')
const bot = require('./bot')

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
				name: 'search',
				description: 'Пошук товарів на OLX',
				options: [
					{
						name: 'query',
						description: 'Що шукаємо?',
						type: 3,
						required: true,
					},
				],
			},
			{
				name: 'help',
				description: 'Показати список команд',
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
			case 'search':
				await bot.handleSearch(
					interaction,
					interaction.options.getString('query')
				)
				break
			case 'help':
				await bot.handleHelp(interaction)
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

client.login(token).catch(error => {
	console.error('Failed to login:', error)
	process.exit(1)
})
