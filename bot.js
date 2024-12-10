const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js')
const axios = require('axios')
const cheerio = require('cheerio')

async function handleSearch(interaction, query, page = 1) {
	try {
		if (!interaction.deferred) {
			await interaction.deferReply()
		}

		const searchUrl = `https://www.olx.ua/d/uk/list/q-${encodeURIComponent(
			query
		)}/?page=${page}`
		const response = await axios.get(searchUrl)
		const $ = cheerio.load(response.data)

		const results = []
		let hasResults = false

		$('div[data-cy="l-card"]').each((i, el) => {
			if (i >= 5) return false

			const title = $(el).find('[data-testid="ad-title"]').text().trim()
			const price = $(el).find('[data-testid="ad-price"]').text().trim()
			const link = $(el).find('a').attr('href')
			const fullLink = link.startsWith('http')
				? link
				: `https://www.olx.ua${link}`
			const imgUrl = $(el).find('img').attr('src')

			results.push({
				title: title || 'Без назви',
				price: price || 'Ціна не вказана',
				link: fullLink,
				imgUrl,
			})

			hasResults = true
		})

		if (!hasResults) {
			return await interaction.editReply('За вашим запитом нічого не знайдено.')
		}

		const embed = new EmbedBuilder()
			.setColor('#00ff00')
			.setTitle(`🔍 Результати пошуку: ${query}`)

		if (results[0]?.imgUrl) {
			embed.setThumbnail(results[0].imgUrl)
		}

		results.forEach((item, i) => {
			embed.addFields({
				name: `${i + 1}.`,
				value: `💰 ${item.price}\n🔗 [Посилання](${item.link})`,
			})
		})

		embed.setFooter({
			text: `Сторінка ${page} • Сьогодні о ${new Date().getHours()}:${String(
				new Date().getMinutes()
			).padStart(2, '0')}`,
		})

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`prev_${query}_${page}`)
				.setLabel('◀️ Назад')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(page <= 1),
			new ButtonBuilder()
				.setCustomId(`next_${query}_${page}`)
				.setLabel('Вперед ▶️')
				.setStyle(ButtonStyle.Primary)
		)

		await interaction.editReply({
			embeds: [embed],
			components: [row],
		})

		const collector = interaction.channel.createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id,
			time: 60000,
		})

		collector.on('collect', async buttonInt => {
			const [action, q, p] = buttonInt.customId.split('_')
			const newPage = action === 'next' ? Number(p) + 1 : Number(p) - 1

			await buttonInt.deferUpdate()
			await handleSearch(interaction, q, newPage)
		})

		collector.on('end', async () => {
			try {
				const message = await interaction.fetchReply()
				if (message) {
					await interaction.editReply({ components: [] })
				}
			} catch (error) {
				console.error('Error removing buttons:', error)
			}
		})
	} catch (error) {
		console.error('Search error:', error)
		const errorMessage = 'Виникла помилка при пошуку. Спробуйте пізніше.'

		if (interaction.deferred) {
			await interaction.editReply({ content: errorMessage })
		} else {
			await interaction.reply({ content: errorMessage, ephemeral: true })
		}
	}
}

async function handleHelp(interaction) {
	const embed = new EmbedBuilder()
		.setColor('#0099ff')
		.setTitle('📋 Команди бота')
		.setDescription(
			'/search <запит> - Пошук товарів на OLX\n' +
				'/help - Показати це повідомлення'
		)

	await interaction.reply({ embeds: [embed] })
}

module.exports = { handleSearch, handleHelp }
