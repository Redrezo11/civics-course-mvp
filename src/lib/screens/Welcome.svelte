<script>
  import { navigate } from '../router.js';
</script>

<div class="min-h-screen flex flex-col max-w-md mx-auto px-6 py-8">
  <div class="flex-1 flex flex-col justify-center">
    <!-- Companion character placeholder — asset not yet generated. Exact
         footprint reserved so dropping the real illustration in later
         causes no layout shift (Colour_Scheme_and_Asset_Direction.md §5). -->
    <div class="w-full aspect-square max-w-[200px] mx-auto mb-6 rounded-card bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_10px,theme(colors.surface)_10px,theme(colors.surface)_20px)] flex items-center justify-center text-center text-xs text-ink-muted p-2">
      companion character<br />(placeholder)
    </div>
    <h1 class="text-heading font-bold text-center mb-3">Welcome.</h1>
    <p class="text-base text-center mb-8">
      This course covers all 128 questions on the U.S. citizenship civics test,
      in short lessons you can fit around your day.
    </p>
    <button class="btn-primary" on:click={() => navigate('/')}>Start</button>
  </div>
  <p class="text-[11px] text-ink-muted dark:text-dark-ink-muted text-center mt-6">
    This course teaches civics and test preparation. For questions about your own
    immigration case, see uscis.gov or a qualified legal-service provider.
  </p>
</div>
