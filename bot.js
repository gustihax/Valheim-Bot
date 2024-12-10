const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js')
const axios = require('axios')
const cheerio = require('cheerio')

async function handleSearch(interaction, query) {
	await interaction.deferReply()
	await searchOlx(interaction, query, 1)
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

async function searchOlx(interaction, query, page = 1) {
	try {
		const searchUrl = `https://www.olx.ua/d/uk/list/q-${encodeURIComponent(
			query
		)}/?page=${page}`
		const response = await axios.get(searchUrl)
		const $ = cheerio.load(response.data)

		const results = []
		let hasResults = false

		$('div[data-cy="l-card"]').each((i, el) => {
			if (i >= 5) return false
			hasResults = true

			const title = $(el).find('[data-testid="ad-title"]').text().trim()
			const price = $(el).find('[data-testid="ad-price"]').text().trim()
			const link = $(el).find('a').attr('href')
			const fullLink = link.startsWith('http')
				? link
				: `https://www.olx.ua${link}`
			const imgUrl =
				$(el).find('img').attr('src') ||
				'https://static.olx.ua/static/olxua/naspersclassifieds-regional/olxeu-atlas-web-olxua/static/img/OLX_Social_Image.png'

			results.push({ title, price, link: fullLink, imgUrl })
		})

		if (!hasResults) {
			await interaction.editReply('За вашим запитом нічого не знайдено.')
			return
		}

		const embed = new EmbedBuilder()
			.setColor('#00ff00')
			.setTitle(`🔍 Результати пошуку: ${query}`)
			.setURL(searchUrl)
			.setFooter({ text: `Сторінка ${page}` })
			.setTimestamp()

		results.forEach((item, i) => {
			embed.addFields({
				name: `${i + 1}. ${item.title}`,
				value: `💰 ${item.price}\n🔗 [Посилання](${item.link})`,
			})
			if (i === 0) {
				embed.setThumbnail(item.imgUrl)
			}
		})

		const hasNextPage = $('a[data-testid="pagination-forward"]').length > 0

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
				.setDisabled(!hasNextPage)
		)

		const message = await interaction.editReply({
			embeds: [embed],
			components: hasNextPage || page > 1 ? [row] : [],
		})

		const collector = message.createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id,
			time: 60000,
		})

		collector.on('collect', async buttonInteraction => {
			const [action, q, p] = buttonInteraction.customId.split('_')
			const newPage = action === 'next' ? parseInt(p) + 1 : parseInt(p) - 1

			await buttonInteraction.deferUpdate()
			await searchOlx(interaction, q, newPage)
		})

		collector.on('end', async () => {
			try {
				await interaction.editReply({
					embeds: [embed],
					components: [],
				})
			} catch (err) {
				console.log('Error removing components:', err)
			}
		})
	} catch (error) {
		console.error('Search error:', error)
		await interaction.editReply(
			'Виникла помилка при пошуку. Спробуйте пізніше.'
		)
	}
}

module.exports = { handleSearch, handleHelp }
