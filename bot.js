const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js')
const axios = require('axios')
const cheerio = require('cheerio')

function createSearchEmbed(query, results, page) {
	const embed = new EmbedBuilder()
		.setColor('#2b2d31')
		.setTitle(`🔍 Результати пошуку: ${query}`)

	const description = results
		.map((item, i) => {
			const price = item.price.includes('грн')
				? item.price
				: `${item.price} грн.`
			return `${i + 1}.\n💰 ${price}\n🔗 [Посилання](${item.link})`
		})
		.join('\n\n')

	embed
		.setDescription(description)
		.setThumbnail(results[0]?.imgUrl || null)
		.setFooter({
			text: `Сторінка ${page} • ${new Date().toLocaleTimeString('uk-UA', {
				hour: '2-digit',
				minute: '2-digit',
			})}`,
		})

	return embed
}

async function handleSearch(interaction, query, page = 1) {
	try {
		const isButton = interaction.isButton()

		if (!isButton) {
			await interaction.deferReply()
		}

		const searchUrl = `https://www.olx.ua/d/uk/list/q-${encodeURIComponent(
			query
		)}/?page=${page}`
		const response = await axios.get(searchUrl)
		const $ = cheerio.load(response.data)

		const results = []
		$('div[data-cy="l-card"]').each((i, el) => {
			if (i >= 5) return false

			const title = $(el).find('[data-testid="ad-title"]').text().trim()
			const price = $(el).find('[data-testid="ad-price"]').text().trim()
			const link = $(el).find('a').attr('href')
			const fullLink = link.startsWith('http')
				? link
				: `https://www.olx.ua${link}`
			const imgUrl = $(el).find('img').attr('src')

			results.push({ title, price, link: fullLink, imgUrl })
		})

		if (results.length === 0) {
			const noResultsMessage = {
				content: '❌ За вашим запитом нічого не знайдено.',
			}
			return isButton
				? await interaction.update(noResultsMessage)
				: await interaction.editReply(noResultsMessage)
		}

		const embed = createSearchEmbed(query, results, page)

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`prev:${query}:${page}`)
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(page <= 1),
			new ButtonBuilder()
				.setCustomId(`next:${query}:${page}`)
				.setEmoji('➡️')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(results.length < 5)
		)

		const messagePayload = { embeds: [embed], components: [row] }

		let reply
		if (isButton) {
			reply = await interaction.update(messagePayload)
		} else {
			reply = await interaction.editReply(messagePayload)
		}

		const filter = i => i.user.id === interaction.user.id
		const collector = reply.createMessageComponentCollector({
			filter,
			time: 300000,
		})

		collector.on('collect', async buttonInt => {
			if (buttonInt.message.interaction?.id !== interaction.id) {
				await buttonInt.reply({
					content:
						'Ця сесія пошуку застаріла. Будь ласка, створіть новий пошук.',
					ephemeral: true,
				})
				return
			}

			const [action, q, p] = buttonInt.customId.split(':')
			const newPage = action === 'next' ? Number(p) + 1 : Number(p) - 1

			try {
				await handleSearch(buttonInt, q, newPage)
			} catch (error) {
				await buttonInt.reply({
					content:
						'❌ Помилка при оновленні результатів. Спробуйте новий пошук.',
					ephemeral: true,
				})
			}
		})
	} catch (error) {
		console.error('Search error:', error)
		const errorMessage = '❌ Помилка при пошуку. Спробуйте пізніше.'

		if (!interaction.deferred && !interaction.replied) {
			await interaction.reply({ content: errorMessage, ephemeral: true })
		} else {
			await interaction.editReply({ content: errorMessage })
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
