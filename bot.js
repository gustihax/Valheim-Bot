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
		const isButton = interaction.isButton?.()

		if (!isButton && !interaction.deferred) {
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
			const reply = { content: '❌ За вашим запитом нічого не знайдено.' }
			return isButton ? interaction.update(reply) : interaction.editReply(reply)
		}

		const embed = new EmbedBuilder()
			.setColor('#00ff00')
			.setTitle(`🔍 Результати пошуку: ${query}`)
			.setDescription('')

		if (results[0]?.imgUrl) {
			embed.setThumbnail(results[0].imgUrl)
		}

		results.forEach((item, i) => {
			const formattedPrice = item.price.includes('грн')
				? item.price
				: `${item.price} грн.`
			embed.addFields({
				name: `${i + 1}.`,
				value: `💰 ${formattedPrice}\n🔗 [Посилання](${item.link})`,
			})
		})

		const currentTime = new Date()
		const timeString = `${currentTime.getHours()}:${String(
			currentTime.getMinutes()
		).padStart(2, '0')}`

		embed.setFooter({
			text: `Сторінка ${page} • Оновлено о ${timeString}`,
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

		const reply = {
			embeds: [embed],
			components: [row],
		}

		if (isButton) {
			await interaction.update(reply)
		} else {
			await interaction.editReply(reply)
		}

		const filter = i => i.user.id === interaction.user.id
		const collector = interaction.channel.createMessageComponentCollector({
			filter,
			time: 60000,
		})

		collector.on('collect', async buttonInt => {
			try {
				const [action, q, p] = buttonInt.customId.split('_')
				const newPage = action === 'next' ? Number(p) + 1 : Number(p) - 1
				await handleSearch(buttonInt, q, newPage)
			} catch (error) {
				console.error('Button interaction error:', error)
			}
		})

		collector.on('end', async () => {
			try {
				const message = await interaction.fetchReply()
				if (message) {
					const disabledRow = new ActionRowBuilder().addComponents(
						row.components[0].setDisabled(true),
						row.components[1].setDisabled(true)
					)
					await interaction.editReply({ components: [disabledRow] })
				}
			} catch (error) {
				console.error('Error disabling buttons:', error)
			}
		})
	} catch (error) {
		console.error('Search error:', error)
		const errorMessage = '❌ Виникла помилка при пошуку. Спробуйте пізніше.'

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
			'🔍 **/search** `<запит>` - Пошук товарів на OLX\n' +
				'❓ **/help** - Показати це повідомлення'
		)

	await interaction.reply({ embeds: [embed] })
}

module.exports = { handleSearch, handleHelp }
