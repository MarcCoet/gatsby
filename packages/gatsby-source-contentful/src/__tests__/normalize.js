const normalize = require(`../normalize`)
const {
  currentSyncData,
  contentTypeItems,
  defaultLocale,
  locales
} = require(`./data.json`)

let entryList
let resolvable
let blankEntries = {}
let foreignReferenceMap
const conflictFieldPrefix = `contentful_test`
// restrictedNodeFields from here https://www.gatsbyjs.org/docs/node-interface/
const restrictedNodeFields = [`id`, `children`, `parent`, `fields`, `internal`]

describe(`Process contentful data`, () => {
  it(`builds entry list`, () => {
    entryList = normalize.buildEntryList({
      currentSyncData,
      contentTypeItems
    })
    expect(entryList).toMatchSnapshot()
  })

  it(`builds list of resolvable data`, () => {
    resolvable = normalize.buildResolvableSet({
      assets: currentSyncData.assets,
      entryList,
      defaultLocale,
      locales
    })
    expect(resolvable).toMatchSnapshot()
  })

  it(`builds foreignReferenceMap`, () => {
    foreignReferenceMap = normalize.buildForeignReferenceMap({
      contentTypeItems,
      entryList,
      resolvable,
      defaultLocale,
      locales
    })
    expect(foreignReferenceMap).toMatchSnapshot()
  })

  it(`creates blank entries`, () => {
    const setBlankEntry = contentTypeItem => {
      const now = new Date().toISOString()
      const fields = {}
      contentTypeItem.fields.forEach(field => {
        fields[field.id] = setBlankField(field)
      })
      const blankEntry = {
        sys: {
          space: contentTypeItem.sys.space,
          id: `cBlank${contentTypeItem.sys.id}`,
          type: `Entry`,
          createdAt: now,
          updatedAt: now,
          revision: 0,
          contentType: {
            sys: {
              type: `Link`,
              linkType: `ContentType`,
              id: `${contentTypeItem.sys.id}`
            }
          }
        },
        fields
      }
      return blankEntry
    }
    contentTypeItems.forEach((contentTypeItem, i) => {
      blankEntries[contentTypeItem.sys.id] = setBlankEntry(contentTypeItem)
    })
    expect(blankEntries).toMatchSnapshot()
  })

  it(`creates nodes for each entry`, () => {
    const createNode = jest.fn()
    const setBlankField = jest.fn()
    contentTypeItems.forEach((contentTypeItem, i) => {
      normalize.createContentTypeNodes({
        contentTypeItem,
        restrictedNodeFields,
        conflictFieldPrefix,
        entries: entryList[i],
        blankEntries,
        setBlankField,
        createNode,
        resolvable,
        foreignReferenceMap,
        defaultLocale,
        locales
      })
    })
    expect(createNode.mock.calls).toMatchSnapshot()
  })

  it(`creates nodes for each asset`, () => {
    const createNode = jest.fn()
    const assets = currentSyncData.assets
    assets.forEach(assetItem => {
      normalize.createAssetNodes({
        assetItem,
        createNode,
        defaultLocale,
        locales
      })
    })
    expect(createNode.mock.calls).toMatchSnapshot()
  })
})

describe(`Fix contentful IDs`, () => {
  it(`leaves ids that start with a string the same`, () => {
    expect(normalize.fixId(`a123`)).toEqual(`a123`)
  })
  it(`left pads ids that start with a number of a "c"`, () => {
    expect(normalize.fixId(`123`)).toEqual(`c123`)
  })
})

describe(`Gets field value based on current locale`, () => {
  const field = {
    de: `Playsam Streamliner Klassisches Auto, Espresso`,
    "en-US": `Playsam Streamliner Classic Car, Espresso`
  }
  it(`Gets the specified locale`, () => {
    expect(
      normalize.getLocalizedField({
        field,
        defaultLocale: `en-US`,
        locale: {
          code: `en-US`
        }
      })
    ).toBe(field[`en-US`])
    expect(
      normalize.getLocalizedField({
        field,
        defaultLocale: `en-US`,
        locale: {
          code: `de`
        }
      })
    ).toBe(field[`de`])
  })
  it(`falls back to the locale's fallback locale if passed a locale that doesn't have a localized field`, () => {
    expect(
      normalize.getLocalizedField({
        field,
        defaultLocale: `en-US`,
        locale: {
          code: `gsw_CH`,
          fallbackCode: `de`
        }
      })
    ).toBe(field[`de`])
  })
  it(`falls back to the default locale if passed a locale that doesn't have a field nor a fallbackCode`, () => {
    expect(
      normalize.getLocalizedField({
        field,
        defaultLocale: `en-US`,
        locale: {
          code: `es-US`,
          fallbackCode: `null`
        }
      })
    ).toBe(field[`en-US`])
  })
})

describe(`Make IDs`, () => {
  it(`It doesn't postfix the id if its the default locale`, () => {
    expect(
      normalize.makeId({
        id: `id`,
        defaultLocale: `en-US`,
        currentLocale: `en-US`
      })
    ).toBe(`id`)
  })
  it(`It does postfix the id if its not the default locale`, () => {
    expect(
      normalize.makeId({
        id: `id`,
        defaultLocale: `en-US`,
        currentLocale: `en-GB`
      })
    ).toBe(`id___en-GB`)
  })
})
