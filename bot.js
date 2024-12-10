const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js')
const axios = require('axios')
const cheerio = require('cheerio')

function createSearchEmbed(query, results, page, imgUrl) {
	const embed = new EmbedBuilder()
		.setColor('#7289DA')
		.setTitle(`🔍 Результати пошуку: ${query}`)
		.setThumbnail(imgUrl || null)
		.setDescription('```css\n[Знайдені оголошення]\n```')

	results.forEach((item, i) => {
		const formattedPrice = item.price.includes('грн')
			? item.price
			: `${item.price} грн.`

		embed.addFields({
			name: `${i + 1}.`,
			value: `**${formattedPrice}**\n[🔗 Посилання](${item.link})`,
			inline: false,
		})
	})

	const currentTime = new Date()
	const timeString = `${currentTime.getHours()}:${String(
		currentTime.getMinutes()
	).padStart(2, '0')}`

	embed.setFooter({
		text: `Сторінка ${page} • Оновлено о ${timeString}`,
		iconURL: 'https://i.imgur.com/AfFp7pu.png',
	})

	return embed
}

function createButtons(query, page, hasResults) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`prev_${query}_${page}`)
			.setLabel('◀️ Назад')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page <= 1),
		new ButtonBuilder()
			.setCustomId(`refresh_${query}_${page}`)
			.setLabel('🔄')
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId(`next_${query}_${page}`)
			.setLabel('Вперед ▶️')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(!hasResults)
	)
}

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

		const embed = createSearchEmbed(query, results, page, results[0]?.imgUrl)
		const row = createButtons(query, page, results.length === 5)

		const reply = {
			embeds: [embed],
			components: [row],
		}

		if (isButton) {
			await interaction.update(reply)
		} else {
			await interaction.editReply(reply)
		}

		const collector = interaction.channel.createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id,
			time: 300000,
		})

		collector.on('collect', async buttonInt => {
			try {
				const [action, q, p] = buttonInt.customId.split('_')

				if (action === 'refresh') {
					await handleSearch(buttonInt, q, Number(p))
				} else {
					const newPage = action === 'next' ? Number(p) + 1 : Number(p) - 1
					await handleSearch(buttonInt, q, newPage)
				}

				collector.stop()
			} catch (error) {
				console.error('Button interaction error:', error)
				await buttonInt.reply({
					content: '❌ Виникла помилка. Спробуйте ще раз.',
					ephemeral: true,
				})
			}
		})

		collector.on('end', async (collected, reason) => {
			if (reason !== 'user' && interaction.message) {
				try {
					const disabledRow = new ActionRowBuilder().addComponents(
						row.components.map(button =>
							ButtonBuilder.from(button).setDisabled(true)
						)
					)
					await interaction.editReply({ components: [disabledRow] })
				} catch (error) {
					console.error('Error disabling buttons:', error)
				}
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
