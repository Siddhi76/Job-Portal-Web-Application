import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Heart, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import JobCard from '../components/JobCard.jsx'
import SearchBar from '../components/SearchBar.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import { JOB_CATEGORIES } from '../data/jobCategories.js'
import { usePortal } from '../context/usePortal.js'

export default function Home() {
  const { jobs, loading, error, reloadJobs } = usePortal()
  const featuredJobs = jobs.slice(0, 4)

  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-eyebrow"><Sparkles size={14} /> A little more you, in your work</div>
          <h1>Find work that<br />feels like <span>your next.</span></h1>
          <p className="hero-description">Good people. Thoughtful teams. Work that matters to you. Your next chapter starts here.</p>
          <SearchBar />
          <div className="hero-proof"><div className="avatar-stack"><span>J</span><span>M</span><span>A</span><span>K</span></div><span><strong>One good next step</strong></span><span className="proof-divider">✳</span><span>Explore current open roles</span></div>
        </div>
        <div className="hero-art" aria-label="Illustration of a person reaching a new career milestone" role="img">
          <div className="art-sun" />
          <div className="art-star star-one">✳</div><div className="art-star star-two">✦</div>
          <div className="art-card art-card-top"><span className="art-card-dot" /> A fresh start <ArrowUpRight size={15} /></div>
          <div className="art-card art-card-bottom"><span className="art-heart"><Heart size={15} fill="currentColor" /></span><span>Work, your way<br /><small>Good things ahead</small></span></div>
          <div className="art-hill hill-back" /><div className="art-hill hill-front" />
          <div className="art-person"><div className="person-head" /><div className="person-body" /><div className="person-arm" /><div className="person-leg leg-one" /><div className="person-leg leg-two" /></div>
          <div className="art-plant"><span /><span /><span /><i /></div>
          <span className="art-caption">A better way forward</span>
        </div>
      </section>

      <section className="trust-strip">
        <span>Good companies, one good place</span><strong>✳ northstar</strong><strong className="trust-wordmark">morrow</strong><strong className="trust-serif">Sunday Co.</strong><strong className="trust-wordmark">FIELDWORK</strong><strong className="trust-serif">common ground</strong>
      </section>

      <section className="section-block categories-section">
        <SectionHeading eyebrow="Find your people" title="A place for every kind of talent">
          Explore opportunities across the fields building what’s next.
        </SectionHeading>
        <div className="category-grid">
          {JOB_CATEGORIES.map((category, index) => (
            <Link key={category.name} to={`/jobs?category=${encodeURIComponent(category.name)}`} className={`category-card category-${index % 4}`}>
              <span className="category-icon">{category.icon}</span><strong>{category.name}</strong><span>{jobs.filter((job) => job.category === category.name).length} open roles <ArrowUpRight size={14} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block featured-section">
        <SectionHeading eyebrow="Picked for you" title="A few good opportunities" action={<Link className="text-link" to="/jobs">Explore all jobs <ArrowRight size={16} /></Link>}>
          Thoughtful teams are looking for thoughtful people.
        </SectionHeading>
        {loading ? <p role="status">Loading open roles…</p> : error ? <div className="empty-state" role="alert"><p>{error}</p><button className="button button-outline" type="button" onClick={() => void reloadJobs()}>Try again</button></div> : featuredJobs.length ? <div className="job-grid">{featuredJobs.map((job) => <JobCard key={job.id} job={job} />)}</div> : <p className="empty-state">No open roles yet. Check back soon.</p>}
      </section>

      <section className="career-cta">
        <div className="cta-icon"><BriefcaseBusiness size={22} /></div><div><p className="eyebrow">On the other side of the table?</p><h2>Meet the people who’ll make it happen.</h2><p>Find your next great teammate. Post your first role in just a few minutes.</p></div><Link className="button button-light" to="/dashboard/employer">Explore employer tools <ArrowRight size={16} /></Link>
      </section>
      <div className="home-bottom-space" />
    </>
  )
}
