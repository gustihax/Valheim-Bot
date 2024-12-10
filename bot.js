const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js')
const axios = require('axios')
const cheerio = require('cheerio')

async function handleSearch(interaction, query) {
	try {
		await interaction.deferReply()
		await searchOlx(interaction, query, 1)
	} catch (error) {
		console.error('Search error:', error)
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({
				content: 'Виникла помилка при пошуку. Спробуйте пізніше.',
				ephemeral: true,
			})
		}
	}
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
			const imgUrl = $(el).find('img').attr('src')

			results.push({ title, price, link: fullLink, imgUrl })
		})

		if (!hasResults) {
			return await interaction.editReply('За вашим запитом нічого не знайдено.')
		}

		const embed = new EmbedBuilder()
			.setColor('#00ff00')
			.setTitle(`🔍 Результати пошуку: ${query}`)
			.setFooter({ text: `Сторінка ${page}` })

		results.forEach((item, i) => {
			embed.addFields({
				name: `${i + 1}. ${item.price}`,
				value: `[${item.title}](${item.link})`,
			})
			if (i === 0 && item.imgUrl) {
				embed.setThumbnail(item.imgUrl)
			}
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

		const message = await interaction.editReply({
			embeds: [embed],
			components: [row],
		})

		const collector = message.createMessageComponentCollector({
			time: 60000,
		})

		collector.on('collect', async buttonInteraction => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				return buttonInteraction.reply({
					content: 'Ви не можете використовувати ці кнопки.',
					ephemeral: true,
				})
			}

			const [action, q, p] = buttonInteraction.customId.split('_')
			const newPage = action === 'next' ? parseInt(p) + 1 : parseInt(p) - 1

			await buttonInteraction.deferUpdate()
			await searchOlx(interaction, q, newPage)
		})

		collector.on('end', () => {
			if (!interaction.replied) return
			interaction
				.editReply({
					components: [],
				})
				.catch(() => {})
		})
	} catch (error) {
		console.error('Search error:', error)
		if (!interaction.replied) {
			await interaction.editReply(
				'Виникла помилка при пошуку. Спробуйте пізніше.'
			)
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
