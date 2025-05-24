<script>
  import { parseMod1Content } from '$lib/parser/mod1Parser'

  let parsedData = null
  let error = null

  async function handleFileUpload(event) {
    const file = event.target.files[0]
    if (!file) return

    try {
      const content = await file.text()
      parsedData = parseMod1Content(content, file.name)
      console.log('parsedData', parsedData)
      error = null
    } catch (err) {
      error = err.message
      parsedData = null
    }
  }
</script>

<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">Mod1 Parser Test</h1>
  
  <div class="mb-4">
    <input
      type="file"
      accept=".mod1"
      on:change={handleFileUpload}
      class="block w-full text-sm text-gray-500
        file:mr-4 file:py-2 file:px-4
        file:rounded-full file:border-0
        file:text-sm file:font-semibold
        file:bg-blue-50 file:text-blue-700
        hover:file:bg-blue-100"
    />
  </div>

  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {error}
    </div>
  {/if}

  {#if parsedData}
    <div class="bg-white shadow rounded-lg p-4">
      <h2 class="text-xl font-semibold mb-2">Parsed Results</h2>
      
      <div class="mb-4">
        <h3 class="font-medium">Metadata:</h3>
        <pre class="bg-gray-50 p-2 rounded">
          {JSON.stringify(parsedData.metadata, null, 2)}
        </pre>
      </div>

      <div>
        <h3 class="font-medium">Points (showing first 10):</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">X</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Y</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Z</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each parsedData.points.slice(0, 10) as point}
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{point.lineIndex}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{point.x}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{point.y}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{point.z}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if parsedData.points.length > 10}
          <p class="text-sm text-gray-500 mt-2">
            Showing first 10 of {parsedData.points.length} points
          </p>
        {/if}
      </div>
    </div>
  {/if}
</div>
