require('dotenv').config()
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js')
const bot = require('./bot')

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
})

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

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN)

client.once('ready', async () => {
	try {
		await rest.put(Routes.applicationCommands(client.user.id), {
			body: commands,
		})
		console.log('Slash commands registered')
		console.log('PCBuilderBot is online!')
	} catch (error) {
		console.error(error)
	}
})

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return

	try {
		if (interaction.commandName === 'search') {
			const query = interaction.options.getString('query')
			await bot.handleSearch(interaction, query)
		} else if (interaction.commandName === 'help') {
			await bot.handleHelp(interaction)
		}
	} catch (error) {
		console.error(error)
		await interaction.reply({
			content: 'Виникла помилка при виконанні команди',
			ephemeral: true,
		})
	}
})

client.login(process.env.DISCORD_TOKEN)
