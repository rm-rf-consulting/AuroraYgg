/**
 * Fetches and parses Yggdrasil public peers from the GitHub repository.
 * Source: https://github.com/yggdrasil-network/public-peers
 */

const GITHUB_API = 'https://api.github.com'
const REPO = 'yggdrasil-network/public-peers'
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/refs/heads/master`

export interface Peer {
  uri: string
  protocol: 'tls' | 'tcp' | 'quic' | 'ws' | 'socks'
  host: string
  port: number
  key?: string
  country: string
  region: string
  description: string
}

export interface PeerCountry {
  name: string
  slug: string
  region: string
  peers: Peer[]
}

export interface PeerRegion {
  name: string
  slug: string
  countries: PeerCountry[]
  totalPeers: number
}

const REGION_LABELS: Record<string, string> = {
  'africa': 'Africa',
  'asia': 'Asia',
  'europe': 'Europe',
  'mena': 'Middle East & North Africa',
  'north-america': 'North America',
  'oceania': 'Oceania',
  'south-america': 'South America',
  'other': 'Other (Overlay Networks)',
}

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Parse a country markdown file to extract peer URIs.
 * Peers are in bullet points as backtick-wrapped URIs like `tls://host:port`
 */
function parsePeersFromMarkdown(
  markdown: string,
  country: string,
  region: string
): Peer[] {
  const peers: Peer[] = []
  const lines = markdown.split('\n')

  let currentDescription = ''

  for (const line of lines) {
    const trimmed = line.trim()

    // Description lines start with * and contain text (not a URI)
    if (trimmed.startsWith('* ') && !trimmed.includes('://')) {
      // Strip markdown formatting
      currentDescription = trimmed
        .slice(2)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
        .replace(/\*+/g, '') // bold/italic
        .trim()
      continue
    }

    // Peer URI lines contain backtick-wrapped URIs
    const uriMatch = trimmed.match(/`((?:tls|tcp|quic|ws|socks):\/\/[^`]+)`/)
    if (uriMatch) {
      const uri = uriMatch[1]
      const parsed = parsePeerUri(uri)
      if (parsed) {
        peers.push({
          ...parsed,
          uri,
          country,
          region,
          description: currentDescription,
        })
      }
    }
  }

  return peers
}

function parsePeerUri(
  uri: string
): { protocol: Peer['protocol']; host: string; port: number; key?: string } | null {
  try {
    // Extract protocol
    const protoMatch = uri.match(/^(tls|tcp|quic|ws|socks):\/\//)
    if (!protoMatch) return null
    const protocol = protoMatch[1] as Peer['protocol']

    // Remove protocol prefix
    let rest = uri.slice(protoMatch[0].length)

    // Extract key parameter if present
    let key: string | undefined
    const keyMatch = rest.match(/\?key=([a-f0-9]+)/)
    if (keyMatch) {
      key = keyMatch[1]
      rest = rest.replace(/\?key=[a-f0-9]+/, '')
    }

    // Handle IPv6 addresses [addr]:port
    let host: string
    let port: number
    const ipv6Match = rest.match(/^\[([^\]]+)\]:(\d+)/)
    if (ipv6Match) {
      host = ipv6Match[1]
      port = parseInt(ipv6Match[2], 10)
    } else {
      // hostname:port or ip:port
      const lastColon = rest.lastIndexOf(':')
      if (lastColon === -1) return null
      host = rest.slice(0, lastColon)
      port = parseInt(rest.slice(lastColon + 1), 10)
    }

    if (isNaN(port)) return null

    return { protocol, host, port, key }
  } catch {
    return null
  }
}

/**
 * Fetch the full list of public peers from the GitHub repository.
 * Returns structured data organized by region → country → peers.
 */
export async function fetchPublicPeers(): Promise<PeerRegion[]> {
  // Step 1: Get the repo tree to find all country files
  const treeRes = await fetch(
    `${GITHUB_API}/repos/${REPO}/git/trees/master?recursive=1`
  )
  if (!treeRes.ok) throw new Error(`GitHub API error: ${treeRes.status}`)
  const tree = await treeRes.json()

  const mdFiles: { path: string; region: string; country: string }[] = []

  for (const item of tree.tree) {
    if (item.type !== 'blob' || !item.path.endsWith('.md')) continue
    if (item.path === 'README.md') continue

    const parts = item.path.split('/')
    if (parts.length !== 2) continue

    mdFiles.push({
      path: item.path,
      region: parts[0],
      country: parts[1].replace('.md', ''),
    })
  }

  // Step 2: Fetch all country files in parallel
  const fetchPromises = mdFiles.map(async (file) => {
    try {
      const res = await fetch(`${RAW_BASE}/${file.path}`)
      if (!res.ok) return null
      const markdown = await res.text()
      const peers = parsePeersFromMarkdown(
        markdown,
        slugToName(file.country),
        file.region
      )
      return {
        name: slugToName(file.country),
        slug: file.country,
        region: file.region,
        peers,
      } as PeerCountry
    } catch {
      return null
    }
  })

  const countries = (await Promise.all(fetchPromises)).filter(
    (c): c is PeerCountry => c !== null && c.peers.length > 0
  )

  // Step 3: Group by region
  const regionMap = new Map<string, PeerCountry[]>()
  for (const country of countries) {
    const existing = regionMap.get(country.region) || []
    existing.push(country)
    regionMap.set(country.region, existing)
  }

  const regions: PeerRegion[] = []
  for (const [slug, regionCountries] of regionMap) {
    regionCountries.sort((a, b) => a.name.localeCompare(b.name))
    regions.push({
      name: REGION_LABELS[slug] || slugToName(slug),
      slug,
      countries: regionCountries,
      totalPeers: regionCountries.reduce((sum, c) => sum + c.peers.length, 0),
    })
  }

  // Sort regions: Europe first (most peers), then by name
  regions.sort((a, b) => {
    if (a.slug === 'europe') return -1
    if (b.slug === 'europe') return 1
    return a.name.localeCompare(b.name)
  })

  return regions
}
